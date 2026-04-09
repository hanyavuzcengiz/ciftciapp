"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { Settings2 } from "lucide-react";
import { getMarketTickers } from "../../lib/api";
import { getClientAuth } from "../../lib/auth-client";
import { SkeletonCard } from "../ui/skeleton";

export function MarketDashboard() {
  const { data, isPending } = useQuery({ queryKey: ["market-tickers"], queryFn: getMarketTickers });
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [storageKey, setStorageKey] = useState("dashboard-widget-settings:guest");

  useEffect(() => {
    const auth = getClientAuth();
    const key = `dashboard-widget-settings:${auth?.userId?.trim() || "guest"}`;
    setStorageKey(key);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setEnabled(parsed);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(enabled));
    } catch {
      // noop
    }
  }, [enabled, storageKey]);

  const rows = useMemo(() => {
    const list = data ?? [];
    return list.filter((x) => enabled[x.key] !== false);
  }, [data, enabled]);

  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Canli Tarim Borsasi</h2>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <Settings2 size={16} /> Dashboard Ayarlari
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((ticker) => (
          <article key={ticker.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-slate-500">{ticker.title}</p>
                <p className="text-xl font-semibold">
                  {ticker.series[ticker.series.length - 1]?.value} {ticker.unit}
                </p>
              </div>
              <span className={ticker.changePct >= 0 ? "text-emerald-600" : "text-rose-600"}>{ticker.changePct}%</span>
            </div>
            <div className="mt-3 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ticker.series}>
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5">
            <h3 className="text-base font-semibold">Widget secimi</h3>
            <div className="mt-3 space-y-2">
              {(data ?? []).map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled[item.key] !== false}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  />
                  {item.title}
                </label>
              ))}
            </div>
            <button onClick={() => setOpen(false)} className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
              Kapat
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

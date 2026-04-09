"use client";

import Link from "next/link";
import { PropsWithChildren, useEffect, useState } from "react";
import { getClientAuth, setClientAuth } from "../lib/auth-client";

export function AppShell({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) return;
    setUserId(auth.userId);
    setAccessToken(auth.accessToken);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm md:px-6">
          <Link href="/" className="font-semibold text-brand-700">
            AgroMarket Web
          </Link>
          <Link href="/listings/new" className="text-slate-600 hover:text-slate-900">
            Ilan Ver
          </Link>
          <Link href="/profile" className="text-slate-600 hover:text-slate-900">
            Profil
          </Link>
          <Link href="/moderation" className="text-slate-600 hover:text-slate-900">
            Moderasyon
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="x-user-id (+90...)"
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Bearer token (opsiyonel)"
              className="w-56 rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <button
              onClick={() => setClientAuth({ userId: userId.trim(), accessToken: accessToken.trim() })}
              className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white"
            >
              Kaydet
            </button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}

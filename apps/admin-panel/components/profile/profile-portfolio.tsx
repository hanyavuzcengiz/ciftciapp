"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getOffers, getSellerStats, getWallet } from "../../lib/api";
import { OfferRow, SellerStat, WalletRow } from "../../lib/types";
import { SkeletonCard } from "../ui/skeleton";

type Row = OfferRow;
type Wallet = WalletRow;

const offerCols: ColumnDef<Row>[] = [
  { header: "Ilan", accessorKey: "listing" },
  { header: "Tutar", accessorKey: "amount" },
  { header: "Durum", accessorKey: "status" },
  { header: "Tarih", accessorKey: "createdAt" }
];

const walletCols: ColumnDef<Wallet>[] = [
  { header: "Aciklama", accessorKey: "title" },
  { header: "Tutar", accessorKey: "amount" },
  { header: "Yon", accessorKey: "direction" },
  { header: "Tarih", accessorKey: "createdAt" }
];

function DataTable<T extends object>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-3 py-2 text-left">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className="px-3 py-2">
                  {c.column.columnDef.cell
                    ? flexRender(c.column.columnDef.cell, c.getContext())
                    : String(c.getValue() ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProfilePortfolio() {
  const score = 82;
  const { data: offers = [], isPending: offersPending } = useQuery({ queryKey: ["profile-offers"], queryFn: getOffers });
  const { data: wallet = [], isPending: walletPending } = useQuery({ queryKey: ["profile-wallet"], queryFn: getWallet });
  const { data: stats = [] } = useQuery<SellerStat[]>({ queryKey: ["profile-stats"], queryFn: getSellerStats });

  if (offersPending || walletPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck size={18} />
            <span className="text-sm font-semibold">Onayli Ciftci (CKS)</span>
          </div>
          <p className="mt-3 text-3xl font-bold">{score}/100</p>
          <p className="mt-1 text-sm text-slate-500">Guven skoru</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Hizli Yanit</p>
          <p className="text-xl font-semibold">88%</p>
          <p className="mt-1 text-sm text-slate-500">Son 30 gun ortalamasi</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <BadgeCheck size={18} className="text-brand-700" />
            <p className="text-sm font-semibold">Basarili Teslimat</p>
          </div>
          <p className="mt-2 text-xl font-semibold">94%</p>
          <p className="text-sm text-slate-500">Iptalsiz siparis orani</p>
        </article>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Ilan Etkilesim Istatistikleri</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="views" fill="#0f766e" name="Goruntulenme" />
              <Bar dataKey="favorites" fill="#22c55e" name="Favori" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">Islem Gecmisi (Teklifler)</h3>
          <DataTable data={offers} columns={offerCols} />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Cuzdan Hareketleri</h3>
          <DataTable data={wallet} columns={walletCols} />
        </div>
      </div>
    </section>
  );
}

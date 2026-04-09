import Link from "next/link";
import { MarketDashboard } from "../components/home/market-dashboard";

export default function AdminHomePage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Tarim ve Hayvancilik Bilgi Merkezi</h1>
        <p className="mt-1 text-sm text-slate-600">Piyasa verileri, ilan performansi ve yonetim aksiyonlari tek panelde.</p>
      </header>
      <MarketDashboard />
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/listings/new" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-700">
          <h3 className="font-semibold">Profesyonel Ilan Verme Akisi</h3>
          <p className="mt-1 text-sm text-slate-600">Multi-step, dinamik alanlar, medya ve harita ile ilan olustur.</p>
        </Link>
        <Link href="/profile" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-700">
          <h3 className="font-semibold">Kurumsal Ciftci Profili</h3>
          <p className="mt-1 text-sm text-slate-600">Guven skoru, karneler, tablo ve grafiklerle profilinizi yonetin.</p>
        </Link>
      </div>
    </section>
  );
}

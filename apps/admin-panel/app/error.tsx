"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-white p-8 text-center">
      <h2 className="text-xl font-semibold text-rose-700">Baglanti veya uygulama hatasi olustu</h2>
      <p className="mt-2 text-sm text-slate-600">{error.message || "Beklenmeyen bir hata olustu."}</p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white"
      >
        Yeniden Dene
      </button>
    </div>
  );
}

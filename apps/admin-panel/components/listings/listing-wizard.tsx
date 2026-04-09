"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAndPublishListing, getCategorySpec } from "../../lib/api";

const DynamicMap = dynamic(() => import("./location-picker-map").then((m) => m.LocationPickerMap), { ssr: false });

const schema = z.object({
  title: z.string().min(5),
  price: z.coerce.number().min(1),
  category: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

const categories = [
  { key: "traktor", label: "Traktor" },
  { key: "tohum", label: "Tohum" }
];

export function ListingWizard() {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState({ lat: 39.9, lng: 32.8 });
  const [files, setFiles] = useState<File[]>([]);
  const [dynamicErrors, setDynamicErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "2022 Case IH Traktor", price: 2450000, category: "traktor" }
  });
  const category = form.watch("category");
  const { data: spec } = useQuery({ queryKey: ["category-spec", category], queryFn: () => getCategorySpec(category) });

  const { getRootProps, getInputProps } = useDropzone({
    multiple: true,
    onDrop: (accepted) => setFiles((prev) => [...prev, ...accepted].slice(0, 10))
  });

  const dynamicSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const field of spec?.fields ?? []) {
      shape[field.key] = field.type === "number" ? z.coerce.number() : z.string().min(field.required ? 1 : 0);
    }
    return z.object(shape);
  }, [spec?.fields]);

  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});

  const moveFile = (from: number, to: number) => {
    setFiles((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return next;
    });
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const goNext = async () => {
    if (step === 1) {
      const ok = await form.trigger(["category", "title", "price"]);
      if (!ok) return;
    }
    if (step === 2) {
      const parsed = dynamicSchema.safeParse(dynamicValues);
      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        const mapped: Record<string, string> = {};
        Object.keys(flat).forEach((k) => {
          mapped[k] = flat[k]?.[0] ?? "Alan gecersiz";
        });
        setDynamicErrors(mapped);
        return;
      }
      setDynamicErrors({});
    }
    if (step === 3 && files.length < 3) {
      setSubmitState("error");
      setSubmitMessage("En az 3 gorsel yuklemelisiniz.");
      return;
    }
    setSubmitState("idle");
    setSubmitMessage("");
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = async () => {
    const base = form.getValues();
    const parsed = dynamicSchema.safeParse(dynamicValues);
    if (!parsed.success) {
      setSubmitState("error");
      setSubmitMessage("Dinamik alanlar gecersiz.");
      return;
    }
    setSubmitState("saving");
    setSubmitMessage("");
    try {
      const imageUrls = files.map((f, i) => `https://placehold.co/1200x800?text=${encodeURIComponent(`ilan-${i + 1}-${f.name}`)}`);
      const created = await createAndPublishListing({
        title: base.title,
        description: `${base.title} icin profesyonel web panelinden olusturuldu.`,
        price: base.price,
        categorySlug: base.category,
        location: { city: "Konya", district: "Selcuklu", lat: location.lat, lng: location.lng },
        attributes: parsed.data,
        images: imageUrls,
        mediaFiles: files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
      });
      setSubmitState("done");
      setSubmitMessage(`Ilan yayinlandi. ID: ${created.id}`);
    } catch (e) {
      setSubmitState("error");
      setSubmitMessage(e instanceof Error ? e.message : "Kayit basarisiz.");
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="mb-4 flex gap-2 text-xs">
        {[1, 2, 3, 4].map((x) => (
          <div key={x} className={`rounded-full px-3 py-1 ${x <= step ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}`}>
            Adim {x}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Kategori ve Temel Bilgi</h2>
              <select className="w-full rounded-lg border border-slate-300 p-2" {...form.register("category")}>
                {categories.map((c) => (
                  <option value={c.key} key={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input className="w-full rounded-lg border border-slate-300 p-2" {...form.register("title")} placeholder="Baslik" />
              <input className="w-full rounded-lg border border-slate-300 p-2" {...form.register("price")} placeholder="Fiyat" type="number" />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Kategoriye Ozel Ozellikler</h2>
              {(spec?.fields ?? []).map((field) => (
                <div key={field.key}>
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    className={`w-full rounded-lg border p-2 ${dynamicErrors[field.key] ? "border-rose-400" : "border-slate-300"}`}
                    placeholder={field.label}
                    value={dynamicValues[field.key] ?? ""}
                    onChange={(e) => setDynamicValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                  {dynamicErrors[field.key] ? <p className="mt-1 text-xs text-rose-600">{dynamicErrors[field.key]}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Medya Yukleme</h2>
              <div {...getRootProps()} className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                <input {...getInputProps()} />
                Surukle birak veya dosya sec (max 10)
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      moveFile(from, index);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"
                  >
                    <p className="line-clamp-2">{file.name}</p>
                    <div className="mt-2 flex gap-1">
                      <button type="button" onClick={() => moveFile(index, index - 1)} className="rounded border border-slate-300 px-2 py-1">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveFile(index, index + 1)} className="rounded border border-slate-300 px-2 py-1">
                        ↓
                      </button>
                      <button type="button" onClick={() => removeFile(index)} className="rounded border border-rose-300 px-2 py-1 text-rose-700">
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Konum Secimi</h2>
              <DynamicMap value={location} onChange={(lat, lng) => setLocation({ lat, lng })} />
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex gap-2">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
          Geri
        </button>
        {step < 4 ? (
          <button onClick={() => void goNext()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
            Ileri
          </button>
        ) : (
          <button onClick={() => void submit()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
            {submitState === "saving" ? "Kaydediliyor..." : "Ilani Kaydet"}
          </button>
        )}
      </div>
      {submitMessage ? (
        <p className={`mt-3 text-sm ${submitState === "done" ? "text-emerald-700" : "text-rose-700"}`}>{submitMessage}</p>
      ) : null}
    </section>
  );
}

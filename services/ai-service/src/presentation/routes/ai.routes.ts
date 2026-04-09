import { Router, type Request, type Response } from "express";
import { z } from "zod";

const router: Router = Router();

const priceSchema = z.object({
  category: z.string().min(1),
  region: z.string().min(1),
  season: z.string().min(1)
});

const textSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional()
});
const visionSchema = z.object({
  category: z.string().min(2).max(80),
  image_urls: z.array(z.string().url()).min(1).max(5)
});

const PYTHON_BASE = process.env.PYTHON_AI_URL ?? "http://127.0.0.1:8010";

router.post("/price-suggestion", async (req: Request, res: Response) => {
  const parsed = priceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  try {
    const r = await fetch(`${PYTHON_BASE}/price-suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    });
    if (!r.ok) throw new Error("python ai down");
    const data = await r.json();
    return res.json(data);
  } catch {
    return res.json({
      degraded: true,
      min: 1000,
      max: 2000,
      currency: "TRY",
      note: "Python AI servisi kapali; yerel tahmin."
    });
  }
});

router.post("/moderate-content", async (req: Request, res: Response) => {
  const parsed = textSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  try {
    const r = await fetch(`${PYTHON_BASE}/moderate-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    });
    if (!r.ok) throw new Error("python ai down");
    const data = await r.json();
    return res.json(data);
  } catch {
    const len = (parsed.data.title?.length ?? 0) + (parsed.data.description?.length ?? 0);
    const score = len > 400 ? 65 : 80;
    return res.json({
      degraded: true,
      score,
      action: score < 70 ? "manual_review" : "auto_ok",
      flags: []
    });
  }
});

router.post("/recommendations", (req: Request, res: Response) => {
  const userId = String(req.header("x-user-id") ?? "anon");
  return res.json({
    userId,
    items: [
      { listingId: "1", score: 0.9, reason: "Son bakilan kategoriler" },
      { listingId: "2", score: 0.82, reason: "Yakin bolge" }
    ]
  });
});

router.post("/vision-listing-suggest", async (req: Request, res: Response) => {
  const parsed = visionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.json({
      degraded: true,
      title: `${parsed.data.category} urunu - temiz durum`,
      description:
        "AI servisi icin OPENAI_API_KEY tanimli degil. Fotoograflara gore otomatik aciklama onerisi icin anahtar ekleyin."
    });
  }
  try {
    const content = [
      { type: "text", text: "Tarim pazaryeri icin kisa bir ilan basligi ve 2-3 cumlelik aciklama uret." },
      ...parsed.data.image_urls.map((url) => ({ type: "image_url", image_url: { url } }))
    ];
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "listing_suggest",
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" }
              },
              required: ["title", "description"],
              additionalProperties: false
            }
          }
        }
      })
    });
    if (!r.ok) throw new Error("openai_failed");
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    const decoded = JSON.parse(raw) as { title?: string; description?: string };
    return res.json({
      title: decoded.title ?? `${parsed.data.category} urunu`,
      description: decoded.description ?? "AI aciklama olusturulamadi."
    });
  } catch {
    return res.json({
      degraded: true,
      title: `${parsed.data.category} urunu - pazarliga acik`,
      description: "Gorseller yuklendi. AI servisi gecici olarak kullanilamadi, lutfen manuel aciklama girin."
    });
  }
});

export default router;

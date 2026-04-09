import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadInput = {
  base64: string;
  mimeType: string;
};

type UploadResult = {
  relUrl: string;
};

const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function extFromMime(mt: string): string {
  const m = mt.toLowerCase();
  if (m.includes("pdf")) return ".pdf";
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  return ".bin";
}

function resolveS3PublicBase(bucket: string, region: string, endpoint?: string): string | null {
  const custom = process.env.VERIFICATION_DOC_PUBLIC_BASE_URL?.trim();
  if (custom) return custom.replace(/\/+$/, "");
  const ep = endpoint?.trim();
  if (!ep) return `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${ep.replace(/\/+$/, "")}/${bucket}`;
}

function getS3Client(): { client: S3Client; bucket: string; publicBase: string | null } | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || "").trim() === "1";
  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey }
  });
  return { client, bucket, publicBase: resolveS3PublicBase(bucket, region, endpoint) };
}

export function getVerificationDocumentStorageMode(): "s3" | "local" {
  return getS3Client() ? "s3" : "local";
}

export async function saveVerificationInlineDocument(input: UploadInput): Promise<UploadResult> {
  const mimeType = input.mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME.has(mimeType)) throw new Error("unsupported_mime_type");
  const key = `verifications/${Date.now()}-${randomUUID()}${extFromMime(mimeType)}`;
  const body = Buffer.from(input.base64, "base64");

  const s3 = getS3Client();
  if (s3) {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType
      })
    );
    if (s3.publicBase) return { relUrl: `${s3.publicBase}/${key}` };
  }

  const root = process.cwd();
  const dir = path.join(root, "uploads", "verifications");
  await mkdir(dir, { recursive: true });
  const abs = path.join(root, "uploads", key);
  await writeFile(abs, body);
  return { relUrl: `/uploads/${key}` };
}

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8080);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024);

await mkdir(UPLOAD_DIR, { recursive: true });

function getBaseUrl(request: Request) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;

  const h = request.headers;

  const rawProto =
    h.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const rawHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";

  const proto = (rawProto.split(",")[0] || "http").trim();
  const host = (rawHost.split(",")[0] || "").trim();

  if (host) return `${proto}://${host}`;
  return `http://localhost:${PORT}`;
}

function safeExt(file: File) {
  const mimeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    "image/tiff": ".tif",
  };

  let ext = mimeMap[file.type] ?? path.extname(file.name ?? "");
  ext = (ext ?? "").toLowerCase();
  if (!ext || !/^\.[a-z0-9]+$/.test(ext)) return "";
  return ext;
}

const app = new Elysia()
  .use(cors({ origin: true }))

  .use(
    staticPlugin({
      assets: UPLOAD_DIR,
      prefix: "/files",
    })
  )

  .get("/health", () => ({ ok: true }))

  .post("/api/upload", async ({ body, set, request }) => {
    const file = (body as any)?.file as File | undefined;
    if (!file) {
      set.status = 400;
      return { ok: false, error: "missing file" };
    }

    if (!file.type.startsWith("image/")) {
      set.status = 415;
      return { ok: false, error: "only image allowed" };
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    if (Number.isFinite(MAX_UPLOAD_BYTES) && buffer.byteLength > MAX_UPLOAD_BYTES) {
      set.status = 413;
      return { ok: false, error: `file too large (max ${MAX_UPLOAD_BYTES} bytes)` };
    }

    const hash = createHash("sha256").update(buffer).digest("hex");
    const ext = safeExt(file);

    const filename = `${hash}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    let dedup = false;
    try {
      await writeFile(filePath, buffer, { flag: "wx" });
    } catch (err: any) {
      if (err?.code === "EEXIST") {
        dedup = true;
      } else {
        throw err;
      }
    }

    const relativePath = `/files/${filename}`;
    const baseUrl = getBaseUrl(request).replace(/\/+$/, "");
    const absoluteUrl = `${baseUrl}${relativePath}`;

    return {
      ok: true,
      hash,
      dedup,
      url: absoluteUrl,  
      path: relativePath, 
    };
  })

  .listen(PORT);

console.log(`Backend running on http://localhost:${PORT}`);

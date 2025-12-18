import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 8080);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";

await mkdir(UPLOAD_DIR, { recursive: true });

function safeExt(type: string | undefined) {
  // 简单映射：你也可以更严格（只允许 image/png、image/jpeg、image/webp 等）
  if (!type) return "";
  if (type.includes("png")) return ".png";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  return "";
}

const app = new Elysia()
  .use(cors({ origin: true }))
  // 让 /files/* 直接访问 uploads 目录中的文件
  .use(
    staticPlugin({
      assets: UPLOAD_DIR,
      prefix: "/files",
    })
  )
  .get("/health", () => ({ ok: true }))
  .post("/api/upload", async ({ body, set, request }) => {
    // Elysia 会把 multipart 的 file 解析为 File
    const file = (body as any)?.file as File | undefined;
    if (!file) {
      set.status = 400;
      return { ok: false, error: "missing file field: file" };
    }

    // 基本校验：只允许图片
    if (!file.type.startsWith("image/")) {
      set.status = 415;
      return { ok: false, error: "only image/* is allowed" };
    }
    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) {
    set.status = 413;
    return { ok: false, error: "file too large (max 5MB)" };
    }


    const ext = safeExt(file.type);
    const id = crypto.randomUUID();
    const filename = `${id}${ext || ""}`;

    const arrayBuffer = await file.arrayBuffer();
    const filepath = path.join(UPLOAD_DIR, filename);
    await writeFile(filepath, new Uint8Array(arrayBuffer));

    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;

    return {
      ok: true,
      filename,
      url: `${origin}/files/${filename}`,
    };
  })
  .listen(PORT);

console.log(`Backend running on http://localhost:${PORT}`);


import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 8080);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";

// 确保 uploads 存在
await mkdir(UPLOAD_DIR, { recursive: true });

// 读取前端入口 HTML（只读一次）
const INDEX_HTML = await readFile("public/index.html", "utf8");

const app = new Elysia()
  .use(cors({ origin: true }))

  // ① 图片访问
  .use(staticPlugin({
    assets: UPLOAD_DIR,
    prefix: "/files",
  }))

  // ② 前端 JS / CSS（非常关键）
  .use(staticPlugin({
    assets: "public/assets",
    prefix: "/assets",
  }))

  // ③ vite.svg / 其他顶层静态文件
  .use(staticPlugin({
    assets: "public",
    prefix: "/",
  }))

  // ④ SPA 入口
  .get("/", () =>
    new Response(INDEX_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  )

  .get("/health", () => ({ ok: true }))

  .post("/api/upload", async ({ body, set }) => {
    const file = (body as any)?.file as File | undefined;
    if (!file) {
      set.status = 400;
      return { ok: false, error: "missing file field: file" };
    }

    if (!file.type.startsWith("image/")) {
      set.status = 415;
      return { ok: false, error: "only image/* allowed" };
    }

    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) {
      set.status = 413;
      return { ok: false, error: "file too large (max 5MB)" };
    }

    const ext = path.extname(file.name || "");
    const filename = `${crypto.randomUUID()}${ext}`;

    const buffer = new Uint8Array(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    return {
      ok: true,
      url: `/files/${filename}`,
    };
  })

  .listen(PORT);

console.log(`Backend running on http://localhost:${PORT}`);

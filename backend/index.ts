import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 8080);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";

await mkdir(UPLOAD_DIR, { recursive: true });

const app = new Elysia()
  .use(cors({ origin: true }))

  // 图片访问
  .use(
    staticPlugin({
      assets: UPLOAD_DIR,
      prefix: "/files",
    })
  )

  .get("/health", () => ({ ok: true }))

  .post("/api/upload", async ({ body, set }) => {
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
    const filename = `${crypto.randomUUID()}${path.extname(file.name || "")}`;
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    return { ok: true, url: `/files/${filename}` };
  })

  .listen(PORT);

console.log(`Backend running on http://localhost:${PORT}`);

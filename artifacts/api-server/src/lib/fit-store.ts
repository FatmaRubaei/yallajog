import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const STORE_DIR = path.join(os.tmpdir(), "yallajog-fit-exports");
const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function metaPath(token: string) {
  return path.join(STORE_DIR, `${token}.json`);
}

function filePath(token: string) {
  return path.join(STORE_DIR, `${token}.fit`);
}

export function saveFitFile(buffer: Buffer, filename: string): string {
  ensureDir();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + TTL_MS;

  fs.writeFileSync(filePath(token), buffer);
  fs.writeFileSync(metaPath(token), JSON.stringify({ filename, expiresAt }));

  purgeExpired();

  return token;
}

export function getFitFile(token: string): { buffer: Buffer; filename: string } | null {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;

  const mp = metaPath(token);
  const fp = filePath(token);

  if (!fs.existsSync(mp) || !fs.existsSync(fp)) return null;

  let meta: { filename: string; expiresAt: number };
  try {
    meta = JSON.parse(fs.readFileSync(mp, "utf8"));
  } catch {
    return null;
  }

  if (Date.now() > meta.expiresAt) {
    try { fs.unlinkSync(mp); } catch {}
    try { fs.unlinkSync(fp); } catch {}
    return null;
  }

  return { buffer: fs.readFileSync(fp), filename: meta.filename };
}

function purgeExpired() {
  try {
    const files = fs.readdirSync(STORE_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const token = f.slice(0, -5);
      const mp = path.join(STORE_DIR, f);
      try {
        const meta = JSON.parse(fs.readFileSync(mp, "utf8"));
        if (Date.now() > meta.expiresAt) {
          fs.unlinkSync(mp);
          try { fs.unlinkSync(filePath(token)); } catch {}
        }
      } catch {}
    }
  } catch {}
}

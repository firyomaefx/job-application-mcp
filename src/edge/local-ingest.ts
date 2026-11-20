import { mkdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { dataDir } from "../store/db.js";

/** Safe filename fragment for incoming uploads. */
export function sanitizeIncomingFilename(name: string): string {
  return basename(name).replace(/[^\w.\-()+@]/g, "_").slice(0, 120) || "resume.bin";
}

/** Save raw resume bytes under `data/incoming/` for `parse_cv`. */
export function saveIncomingResume(filename: string, bytes: Buffer): string {
  const root = dataDir();
  const dir = join(root, "incoming");
  mkdirSync(dir, { recursive: true });
  const safe = sanitizeIncomingFilename(filename);
  const dest = join(dir, `${Date.now()}-${safe}`);
  writeFileSync(dest, bytes);
  return dest;
}
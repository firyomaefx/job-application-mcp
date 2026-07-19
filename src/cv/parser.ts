import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { dataDir } from "../store/db.js";

export interface ParsedCv {
  text: string;
  format: "pdf" | "docx" | "txt";
  charCount: number;
}

/**
 * Roots a CV file may be read from. By default: the local data dir (and its
 * `cvs/` subdir). Add more with JOB_MCP_CV_DIRS (OS path separator: `;` on
 * Windows, `:` elsewhere). This stops an MCP client from pointing parse_cv at
 * arbitrary files (e.g. ~/.ssh/id_rsa, /etc/passwd) and exfiltrating contents.
 */
function allowedRoots(): string[] {
  const data = resolve(dataDir());
  const roots = [data, resolve(data, "cvs")];
  const extra = process.env.JOB_MCP_CV_DIRS;
  if (extra) {
    const sepChar = process.platform === "win32" ? ";" : ":";
    for (const r of extra.split(sepChar)) {
      const t = r.trim();
      if (t) roots.push(resolve(t));
    }
  }
  return roots;
}

/** Throw if filePath is not inside an allowed root. Returns the resolved path. */
function assertAllowed(filePath: string): string {
  const target = resolve(filePath);
  const ok = allowedRoots().some((root) => target === root || target.startsWith(root + sep));
  if (!ok) {
    throw new Error(
      `File "${filePath}" is outside the allowed CV import roots. ` +
        `Move it under the data dir (${resolve(dataDir())}) or list its folder in JOB_MCP_CV_DIRS.`,
    );
  }
  return target;
}

/**
 * Parse a CV file into plain text. Supports PDF, DOCX, and plain text.
 * Runs entirely locally — no upload, no network. The path must be inside an
 * allowed import root (see assertAllowed).
 */
export async function parseCvFile(filePath: string): Promise<ParsedCv> {
  const safePath = assertAllowed(filePath);
  const ext = extname(safePath).toLowerCase();
  const format: ParsedCv["format"] =
    ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : "txt";

  if (format === "pdf") {
    // pdf-parse's type declaration doesn't expose the ESM default; the runtime has it.
    const mod = (await import("pdf-parse")) as unknown as {
      default: (buf: Buffer) => Promise<{ text?: string }>;
    };
    const pdfParse = mod.default;
    const buf = await readFile(safePath);
    const data = await pdfParse(buf);
    return { text: data.text ?? "", format, charCount: (data.text ?? "").length };
  }

  if (format === "docx") {
    const mammoth = await import("mammoth");
    const buf = await readFile(safePath);
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value, format, charCount: result.value.length };
  }

  // Plain text / markdown / anything else: read as utf-8.
  const text = await readFile(safePath, "utf8");
  return { text, format, charCount: text.length };
}

/** Parse CV text that was supplied inline (e.g. pasted by the user). */
export function parseCvText(text: string): ParsedCv {
  return { text, format: "txt", charCount: text.length };
}
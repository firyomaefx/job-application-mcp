import { readFile } from "node:fs/promises";
import { extname } from "node:path";

export interface ParsedCv {
  text: string;
  format: "pdf" | "docx" | "txt";
  charCount: number;
}

/**
 * Parse a CV file into plain text. Supports PDF, DOCX, and plain text.
 * Runs entirely locally — no upload, no network.
 */
export async function parseCvFile(filePath: string): Promise<ParsedCv> {
  const ext = extname(filePath).toLowerCase();
  const format: ParsedCv["format"] =
    ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : "txt";

  if (format === "pdf") {
    // pdf-parse's type declaration doesn't expose the ESM default; the runtime has it.
    const mod = (await import("pdf-parse")) as unknown as {
      default: (buf: Buffer) => Promise<{ text?: string }>;
    };
    const pdfParse = mod.default;
    const buf = await readFile(filePath);
    const data = await pdfParse(buf);
    return { text: data.text ?? "", format, charCount: (data.text ?? "").length };
  }

  if (format === "docx") {
    const mammoth = await import("mammoth");
    const buf = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value, format, charCount: result.value.length };
  }

  // Plain text / markdown / anything else: read as utf-8.
  const text = await readFile(filePath, "utf8");
  return { text, format, charCount: text.length };
}

/** Parse CV text that was supplied inline (e.g. pasted by the user). */
export function parseCvText(text: string): ParsedCv {
  return { text, format: "txt", charCount: text.length };
}
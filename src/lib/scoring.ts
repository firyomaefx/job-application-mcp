import type { MatchResult } from "./types.js";

// ── Keyword extraction ─────────────────────────────────────────

const STOPWORDS = new Set<string>([
  "the", "and", "for", "with", "you", "are", "our", "will", "this", "that",
  "from", "have", "has", "your", "all", "any", "can", "who", "but", "not",
  "into", "their", "they", "them", "what", "when", "where", "which", "how",
  "must", "should", "would", "could", "per", "etc", "via", "able", "about",
  "above", "across", "after", "again", "also", "been", "being", "both",
  "each", "else", "even", "here", "than", "then", "there", "these", "those",
  "was", "were", "very", "we", "us", "an", "as", "at", "be", "by", "do", "if",
  "in", "is", "it", "of", "on", "or", "so", "to", "up", "a", "i",
  // common job-ad verbs / fillers that aren't skills
  "seek", "seeking", "we", "looking", "join", "build", "work", "role",
  "team", "experience", "plus", "ability", "strong", "good", "great",
  "opportunity", "candidate", "candidates", "ideal", "preferred", "required",
  "responsibilities", "requirements", "qualifications", "skills", "year",
  "years", "including", "include", "includes", "using", "use", "used",
  "across", "well", "etc", "may", "might", "need", "needs", "help",
]);

const TECH_HINTS = new Set<string>([
  "js", "ts", "c#", "c++", "f#", "go", "rs", "rb", "py", "sql", "html", "css",
  "aws", "gcp", "k8s", "ci", "cd", "ai", "ml", "ui", "ux", "qa", "seo", "etl",
  "sap", "crm", "erp", "pr", "hr", "b2b", "b2c", "om", "roi", "kpi", "okr",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.\-]+/i)
    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, "").trim()) // strip leading/trailing dots/dashes
    .filter((t) => t.length > 0);
}

/** Extract candidate keywords (skills/tech) from free text. */
export function extractKeywords(text: string, limit = 30): string[] {
  const freq = new Map<string, number>();
  for (const raw of tokenize(text)) {
    const tok = raw.toLowerCase();
    if (STOPWORDS.has(tok)) continue;
    if (tok.length < 2 && !TECH_HINTS.has(tok)) continue;
    if (/^\d+$/.test(tok) && tok.length < 4) continue; // skip bare numbers
    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
  // Weight multi-word-ish tokens (kept as single tokens here) and tech hints.
  const scored = [...freq.entries()].map(([tok, count]) => ({
    tok,
    score: count + (TECH_HINTS.has(tok) ? 2 : 0) + (tok.length >= 4 ? 1 : 0),
  }));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.tok);
}

// ── Matching ───────────────────────────────────────────────────

/** Normalize a token for comparison (trim, lowercase, drop trailing dots). */
function norm(t: string): string {
  return t.toLowerCase().replace(/[.\-]+$/, "").trim();
}

/**
 * Score a candidate's skills against a job's required keywords.
 * Pure function — no I/O. Score is 0..100.
 *
 * Weights matched skills heavily; partial credit for stemmed matches
 * (e.g. "react" vs "reactjs"); surface missing high-value skills.
 */
export function scoreMatch(candidateSkills: string[], jobKeywords: string[]): MatchResult {
  const cand = new Set(candidateSkills.map(norm));
  const job = jobKeywords.map(norm);

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of job) {
    if (kw.length === 0) continue;
    const hit = cand.has(kw) || candidateSkills.some((s) => isStemMatch(norm(s), kw));
    if (hit) matched.push(kw);
    else missing.push(kw);
  }

  const extra = candidateSkills
    .map(norm)
    .filter((s) => !job.includes(s) && s.length > 0)
    .slice(0, 15);

  const denom = Math.max(job.length, 1);
  const base = (matched.length / denom) * 100;

  // Gentle bonus for breadth of extra skills (capped) — only meaningful when
  // there are job keywords to match against.
  const breadthBonus = job.length > 0 ? Math.min(extra.length, 10) * 0.5 : 0;

  const score = Math.round(Math.min(100, base + breadthBonus));

  const notes: string[] = [];
  if (missing.length > 0) {
    notes.push(
      `Missing ${missing.length} of ${job.length} key skills: ${missing.slice(0, 8).join(", ")}.`
    );
  }
  if (matched.length === job.length && job.length > 0) {
    notes.push("All key requirements present — strong match.");
  }
  if (job.length === 0) {
    notes.push("No job keywords extracted; review the job description.");
  }
  if (score < 50 && job.length > 0) {
    notes.push("Below 50% match — consider tailoring CV or skipping this role.");
  }

  return { score, matched, missing, extra, notes };
}

function isStemMatch(skill: string, keyword: string): boolean {
  if (skill === keyword) return true;
  if (skill.length < 3 || keyword.length < 3) return false;
  // "react" ~ "reactjs", "node" ~ "nodejs", "typescript" ~ "ts"
  if (skill.startsWith(keyword) || keyword.startsWith(skill)) {
    return Math.abs(skill.length - keyword.length) <= 3;
  }
  return false;
}
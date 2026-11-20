import { extractKeywords, scoreMatch } from "./lib/scoring.js";
import type { Cv } from "./lib/types.js";
import { saveCv } from "./store/applications.js";
import { openDb } from "./store/db.js";
import { getDefaultProfile } from "./store/profile.js";

/** Returned when a job is checked before any CV exists. Do not paraphrase. */
export const NO_CV_SAY = "No CV saved. Paste your CV first.";

const UNTITLED_ROLE = "Untitled role";

export type SimpleSay = { say: string };

/**
 * Store one CV. Replaces any previous active CV for this profile.
 * Does not ask for a name, email, or years, and does not call an AI.
 */
export function saveMyCv(text: string): SimpleSay {
  const trimmed = text.trim();
  if (!trimmed) return { say: "Paste your CV text." };

  const profile = getDefaultProfile();
  openDb()
    .prepare("UPDATE cvs SET is_active = 0 WHERE profile_id = ? AND is_active = 1")
    .run(profile.id);
  saveCv(profile.id, "mine", trimmed, null);

  const skills = extractKeywords(trimmed, 30);
  if (skills.length === 0) return { say: "Saved. 0 skills found. Paste a job next." };
  return { say: `Saved. ${skills.length} skills found: ${skills.join(", ")}. Paste a job next.` };
}

/**
 * Score a pasted job against the one saved CV. Local keywords only.
 * Writes nothing when no CV is stored. The role title is "Untitled role"
 * unless the caller passes one — the first line of the posting is not a title.
 */
export function checkThisJob(input: { description: string; title?: string }): SimpleSay {
  const cv = latestActiveCv();
  if (!cv) return { say: NO_CV_SAY };

  const role = input.title?.trim() ? input.title.trim() : UNTITLED_ROLE;
  const result = scoreMatch(extractKeywords(cv.text, 30), extractKeywords(input.description, 30));
  const matched = result.matched.length ? result.matched.join(", ") : "none";
  const missing = result.missing.length ? result.missing.join(", ") : "none";
  const note = [
    `Matched skills you can name: ${matched}.`,
    "These are the only skills this card supports.",
    "Do not add employers.",
    "Do not add dates.",
    "Do not add numbers.",
  ];
  return {
    say: [
      `Role: ${role}`,
      `Score: ${result.score}/100`,
      `In both: ${matched}`,
      `Only in the job: ${missing}`,
      ...note,
    ].join("\n"),
  };
}

function latestActiveCv(): Cv | null {
  const row = openDb()
    .prepare("SELECT * FROM cvs WHERE is_active = 1 ORDER BY id DESC LIMIT 1")
    .get();
  return (row as Cv | undefined) ?? null;
}

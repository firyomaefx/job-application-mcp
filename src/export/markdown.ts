// Pure Markdown export — no I/O, fully unit-testable.
//
// Renders a CV (and optionally a cover letter / tailored snippet) to a clean
// Markdown string suitable for `print-to-PDF` or plain-file export. The desktop
// app uses Electron's webContents.printToPDF for the PDF path (no heavy npm
// dependency); this module is the shared text source for both Markdown and the
// printable HTML template.

import type { CandidateProfile, Cv, Job, Application } from "../lib/types.js";

export interface CvMarkdownInput {
  profile: Pick<CandidateProfile, "full_name" | "email" | "phone" | "location" | "headline" | "skills" | "experience_years" | "summary">;
  cv: Pick<Cv, "label" | "text">;
  job?: Pick<Job, "title" | "company"> | null;
  coverLetter?: string | null;
  tailoredCv?: string | null;
}

/** Render a CV to Markdown. Pure: same input → same output. */
export function cvToMarkdown(input: CvMarkdownInput): string {
  const { profile, cv, job, coverLetter, tailoredCv } = input;
  const lines: string[] = [];

  lines.push(`# ${profile.full_name || "Curriculum Vitae"}`);
  if (profile.headline) lines.push(`\n*${profile.headline}*`);
  lines.push("");

  const contact = [profile.email, profile.phone, profile.location].filter(Boolean);
  if (contact.length) {
    lines.push(contact.join(" · "));
    lines.push("");
  }

  if (job) {
    lines.push(`> Tailored for **${job.title}**${job.company ? ` — ${job.company}` : ""}`);
    lines.push("");
  }

  if (profile.summary) {
    lines.push("## Summary");
    lines.push(profile.summary);
    lines.push("");
  }

  if (Array.isArray(profile.skills) && profile.skills.length) {
    lines.push("## Skills");
    lines.push(profile.skills.map((s) => `\`${s}\``).join(" "));
    lines.push("");
  }

  if (profile.experience_years != null) {
    lines.push(`**Experience:** ${profile.experience_years} years`);
    lines.push("");
  }

  const body = tailoredCv && tailoredCv.trim().length > 0 ? tailoredCv : cv.text;
  lines.push(`## ${cv.label}`);
  lines.push("");
  lines.push(body.trim());
  lines.push("");

  if (coverLetter && coverLetter.trim().length) {
    lines.push("## Cover letter");
    lines.push("");
    lines.push(coverLetter.trim());
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

/** Render an application (job + tailored CV + cover letter + answers) to Markdown. */
export function applicationToMarkdown(
  app: Pick<Application, "id" | "status" | "match_score" | "answers" | "cover_letter" | "tailored_cv_text" | "notes">,
  job: Pick<Job, "title" | "company"> | null,
  profile: CvMarkdownInput["profile"],
  cv: CvMarkdownInput["cv"]
): string {
  const lines: string[] = [];
  lines.push(`# Application ${app.id}`);
  if (job) lines.push(`\n*${job.title}${job.company ? ` — ${job.company}` : ""}*`);
  lines.push("");
  lines.push(`- Status: \`${app.status}\``);
  if (app.match_score != null) lines.push(`- Match score: ${app.match_score}/100`);
  lines.push("");
  if (app.tailored_cv_text) {
    lines.push("## Tailored CV");
    lines.push(app.tailored_cv_text.trim());
    lines.push("");
  } else {
    lines.push(cvToMarkdown({ profile, cv, job, coverLetter: app.cover_letter }));
    lines.push("");
  }
  const answers = app.answers ?? {};
  const keys = Object.keys(answers);
  if (keys.length) {
    lines.push("## Screening answers");
    for (const k of keys) {
      lines.push(`**${k}**`);
      lines.push(answers[k] ?? "");
      lines.push("");
    }
  }
  if (app.notes) {
    lines.push("## Notes");
    lines.push(app.notes.trim());
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}
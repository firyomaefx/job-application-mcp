// ATS-only auto-submit. LinkedIn and Indeed apply flows are blocked (ToS).

const BLOCKED_APPLY_HOSTS =
  /(^|\.)linkedin\.com$|(^|\.)indeed\.com$|(^|\.)glassdoor\.com$/i;

export type PlatformClass =
  | { allowed: true; adapter_id: string; confidence: "high" | "medium" | "low" }
  | { allowed: false; reason: string };

export function classifyApplyUrl(rawUrl: string): PlatformClass {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allowed: false, reason: "URL must be http(s)" };
  }
  const host = url.hostname;
  if (BLOCKED_APPLY_HOSTS.test(host)) {
    return {
      allowed: false,
      reason:
        "auto-apply is not supported on LinkedIn, Indeed, or Glassdoor (import/analysis only). Use the employer ATS apply URL.",
    };
  }

  if (/greenhouse\.io$/i.test(host) || host.includes("greenhouse")) {
    return { allowed: true, adapter_id: "greenhouse", confidence: "high" };
  }
  if (/lever\.co$/i.test(host) || host.includes("lever.co")) {
    return { allowed: true, adapter_id: "lever", confidence: "high" };
  }
  if (/ashbyhq\.com$/i.test(host) || host.includes("ashby")) {
    return { allowed: true, adapter_id: "ashby", confidence: "high" };
  }
  if (/smartrecruiters\.com$/i.test(host)) {
    return { allowed: true, adapter_id: "smartrecruiters", confidence: "medium" };
  }
  if (/myworkdayjobs\.com$/i.test(host) || /workday\.com$/i.test(host)) {
    return { allowed: true, adapter_id: "workday", confidence: "low" };
  }

  // Generic career-page forms (user must be on the apply page).
  return { allowed: true, adapter_id: "generic", confidence: "low" };
}
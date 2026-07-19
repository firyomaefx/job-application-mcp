// Pure form-field classification logic (N8). Extracted from the autofill tool
// and the Chrome extension so the rules are unit-testable without a DOM.
//
// Two responsibilities:
//   - guessFieldKey: map a form field (name + label) to a candidate property.
//   - isSensitiveField: flag legal/salary/authorization/etc. fields that need
//     explicit user review before any submission.
//
// The extension keeps a parallel copy of these rules (it cannot import the TS
// src at runtime); keep them in sync. Tests pin the behaviour here.

export const SENSITIVE_PATTERN =
  /salary|compensation|authorized|authorised|visa|sponsor|gender|race|ethnic|disability|consent|agree|ssn|national|criminal/i;

export const SKIP_FIELD_TYPES = new Set([
  "hidden",
  "password",
  "submit",
  "button",
  "image",
  "file",
  "reset",
]);

export function isSensitiveField(name: string, label?: string): boolean {
  return SENSITIVE_PATTERN.test(`${name} ${label ?? ""}`);
}

/** Map a form field to a candidate property key, or "" if no match. */
export function guessFieldKey(name: string, label?: string): string {
  const s = `${name} ${label ?? ""}`.toLowerCase();
  if (s.includes("cover")) return "cover_letter";
  if (s.includes("mail")) return "email";
  if (s.includes("phone") || s.includes("mobile") || s.includes("tel")) return "phone";
  if (s.includes("location") || s.includes("city") || s.includes("address")) return "location";
  if (s.includes("title") || s.includes("headline")) return "headline";
  if (s.includes("name")) return "full_name";
  return "";
}

export interface RawField {
  name: string;
  label?: string;
  type?: string;
}

export interface ClassifiedField {
  field: string;
  label: string;
  mapped_to: string;
  value: string;
  confidence: "high" | "none";
  requires_user_review: boolean;
  sensitive: boolean;
}

/**
 * Classify a raw form field against candidate values (profile + application).
 * A field requires user review if it is sensitive OR has no mapped value.
 */
export function classifyField(f: RawField, candidateValues: Record<string, string>): ClassifiedField {
  const key = guessFieldKey(f.name, f.label);
  const value = candidateValues[key] ?? "";
  const sensitive = isSensitiveField(f.name, f.label);
  return {
    field: f.name,
    label: f.label ?? f.name,
    mapped_to: key,
    value,
    confidence: value ? "high" : "none",
    requires_user_review: !value || sensitive,
    sensitive,
  };
}
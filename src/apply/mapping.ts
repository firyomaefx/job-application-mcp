import { classifyField, type RawField, type ClassifiedField } from "../forms/fields.js";
import { DEFAULT_ANSWER_KEYS } from "../store/apply-defaults.js";

const TRUSTED_DEFAULT_KEYS = new Set<string>(DEFAULT_ANSWER_KEYS);

export function classifyFieldsForApply(
  fields: RawField[],
  candidateValues: Record<string, string>,
): ClassifiedField[] {
  return fields.map((f) => {
    const base = classifyField(f, candidateValues);
    const key = base.mapped_to;
    const trusted = key && TRUSTED_DEFAULT_KEYS.has(key) && Boolean(base.value);
    if (base.sensitive && trusted) {
      return { ...base, requires_user_review: false, confidence: "high" };
    }
    return base;
  });
}

export function mappingBlocksAutoSubmit(mapping: ClassifiedField[]): ClassifiedField[] {
  return mapping.filter((f) => f.requires_user_review);
}
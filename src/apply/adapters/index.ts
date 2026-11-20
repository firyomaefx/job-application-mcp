import type { AdapterHints } from "./types.js";

const REGISTRY: Record<string, AdapterHints> = {
  greenhouse: {
    id: "greenhouse",
    submit_selectors: [
      "#submit_app",
      'input[type="submit"]',
      'button[type="submit"]',
      "button.application-submit",
    ],
    apply_link_selectors: ["a#apply_button", 'a[href*="applications/new"]'],
    notes: ["Greenhouse embed; multi-page may require manual navigation."],
  },
  lever: {
    id: "lever",
    submit_selectors: [
      'button[type="submit"]',
      "button.postings-btn",
      'input[type="submit"]',
    ],
    apply_link_selectors: ['a.postings-btn', 'a[href*="/apply"]'],
    notes: ["Lever posting apply flow."],
  },
  ashby: {
    id: "ashby",
    submit_selectors: ['button[type="submit"]', 'input[type="submit"]'],
    notes: ["Ashby hosted apply forms."],
  },
  smartrecruiters: {
    id: "smartrecruiters",
    submit_selectors: ['button[type="submit"]', "button.c-button--primary"],
    notes: ["SmartRecruiters; layout changes frequently — may pause."],
  },
  workday: {
    id: "workday",
    submit_selectors: ['button[type="submit"]', 'input[type="submit"]'],
    notes: ["Workday often multi-step; auto-apply may pause for manual steps."],
  },
  generic: {
    id: "generic",
    submit_selectors: [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[data-testid*="submit"]',
      'button:not([type="button"])',
    ],
    notes: ["Best-effort generic career form; review before enabling auto-submit."],
  },
};

export function getAdapterHints(adapterId: string): AdapterHints {
  return REGISTRY[adapterId] ?? REGISTRY.generic;
}

export function listAdapterIds(): string[] {
  return Object.keys(REGISTRY);
}
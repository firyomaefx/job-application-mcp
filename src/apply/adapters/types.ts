export interface AdapterHints {
  id: string;
  /** CSS selectors tried in order for the primary submit control. */
  submit_selectors: string[];
  /** Optional “Apply” link before the form (career listing pages). */
  apply_link_selectors?: string[];
  notes: string[];
}
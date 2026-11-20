export interface AdapterHints {
  id: string;
  /** CSS selectors tried in order for the primary submit control. */
  submit_selectors: string[];
  /** Optional “Apply” link before the form (career listing pages). */
  apply_link_selectors?: string[];
  /** Resume/CV file inputs (tried before generic input[type=file]). */
  file_input_selectors?: string[];
  /** Multi-step “Continue/Next” controls (never used as final submit). */
  next_selectors?: string[];
  notes: string[];
}
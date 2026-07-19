// Core domain types shared across tools and the store.

export interface CandidateProfile {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  experience_years: number | null;
  // Free core: one profile. Pro: multiple. Field kept for forward-compat.
  label: string;
  created_at: string;
  updated_at: string;
}

export interface Cv {
  id: number;
  profile_id: number;
  label: string;
  source_path: string | null;
  text: string;
  created_at: string;
}

export interface Job {
  id: number;
  profile_id: number;
  title: string;
  company: string | null;
  url: string | null;
  description: string;
  // Skills/keywords extracted from the description during analysis.
  keywords: string[];
  created_at: string;
}

export type ApplicationStatus =
  | "draft"
  | "ready"
  | "submitted"
  | "interview"
  | "offer"
  | "rejected"
  | "closed";

export interface Application {
  id: number;
  profile_id: number;
  job_id: number;
  cv_id: number | null;
  status: ApplicationStatus;
  match_score: number | null; // 0..100
  tailored_cv_text: string | null;
  cover_letter: string | null;
  answers: Record<string, string>;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  score: number; // 0..100
  matched: string[];
  missing: string[];
  extra: string[];
  notes: string[];
}
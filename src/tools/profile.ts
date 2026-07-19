import { z } from "zod";
import type { ToolDef } from "./types.js";
import { getDefaultProfile, updateProfile } from "../store/profile.js";

const getProfileSchema = z.object({});

export const getProfileTool: ToolDef<typeof getProfileSchema> = {
  name: "get_profile",
  description:
    "Return the candidate's local profile (free core: one default profile, auto-created on first call).",
  inputSchema: getProfileSchema,
  run: () => {
    const profile = getDefaultProfile();
    return {
      summary: `Profile for ${profile.full_name} (id ${profile.id}, ${profile.skills.length} skills on file).`,
      data: profile,
    };
  },
};

const updateProfileSchema = z.object({
  full_name: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  skills: z.array(z.string()).optional(),
  experience_years: z.number().nullable().optional(),
});

export const updateProfileTool: ToolDef<typeof updateProfileSchema> = {
  name: "update_profile",
  description:
    "Update the candidate profile. Pass any subset of fields. skills replaces the skill list.",
  inputSchema: updateProfileSchema,
  run: (input) => {
    const profile = getDefaultProfile();
    const updated = updateProfile(profile.id, input);
    return {
      summary: `Profile updated: ${updated.full_name}, ${updated.skills.length} skills.`,
      data: updated,
    };
  },
};
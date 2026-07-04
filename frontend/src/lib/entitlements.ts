/**
 * Plan entitlements — the single source of truth for which features each
 * subscription plan unlocks. Gate paid features off `useEntitlement(feature)`
 * (or the `PLAN_FEATURES` map) rather than checking the plan string inline, so
 * adding/moving a feature is a one-line change here.
 */

import { useAuth } from "@/contexts/AuthContext";

export type Plan = "free" | "pro";

export type Feature =
  | "hdExport" // 1080p+/high-bitrate export
  | "noWatermark" // remove the DemoForge watermark from renders
  | "unlimitedRenders" // render as many times as you like
  | "premiumBackgrounds"; // premium background presets

/** Which features each plan includes. */
export const PLAN_FEATURES: Record<Plan, Feature[]> = {
  free: [],
  pro: ["hdExport", "noWatermark", "unlimitedRenders", "premiumBackgrounds"],
};

/** Human-friendly copy for upgrade prompts, keyed by feature. */
export const FEATURE_LABELS: Record<Feature, string> = {
  hdExport: "HD & high-bitrate export",
  noWatermark: "Watermark-free videos",
  unlimitedRenders: "Unlimited renders",
  premiumBackgrounds: "Premium backgrounds",
};

export function planHasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

/** The current user's plan (defaults to "free" for guests / missing data). */
export function usePlan(): Plan {
  const { user } = useAuth();
  return user?.plan ?? "free";
}

/** True when the current user is entitled to `feature`. */
export function useEntitlement(feature: Feature): boolean {
  return planHasFeature(usePlan(), feature);
}

/* ------------------------------------------------------------------ */
/* Editor capability tiers                                             */
/* ------------------------------------------------------------------ */

export type EditorTab =
  | "script"
  | "voice"
  | "design"
  | "text"
  | "camera"
  | "effects"
  | "polish"
  | "music"
  | "timeline";

/** Tabs a logged-in FREE user may edit. Everything else is Pro. */
export const FREE_EDITOR_TABS: EditorTab[] = ["text", "timeline"];

export const ALL_EDITOR_TABS: EditorTab[] = [
  "script",
  "voice",
  "design",
  "text",
  "camera",
  "effects",
  "polish",
  "music",
  "timeline",
];

export type EditorAccess = "guest" | "free" | "pro";

export function editorAccessFor(isAuthenticated: boolean, plan: Plan): EditorAccess {
  if (!isAuthenticated) return "guest";
  return plan === "pro" ? "pro" : "free";
}

/**
 * Which editor tabs are locked for a given access level, mapped to the reason
 * shown on the lock. Guests can't edit anything (preview + render only); free
 * users get text + timeline; Pro unlocks everything.
 */
export function editorTabLocks(
  access: EditorAccess
): Partial<Record<EditorTab, string>> {
  if (access === "pro") return {};

  const locks: Partial<Record<EditorTab, string>> = {};
  for (const tab of ALL_EDITOR_TABS) {
    if (access === "guest") {
      locks[tab] = "Log in to edit your demo. Guests can preview and render.";
    } else if (!FREE_EDITOR_TABS.includes(tab)) {
      locks[tab] = "Upgrade to Pro to unlock full editing.";
    }
  }
  return locks;
}

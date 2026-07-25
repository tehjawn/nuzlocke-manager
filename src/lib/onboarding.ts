import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";

/** Default season for first-run onboarding after Discord login. */
export const ONBOARDING_CHALLENGE_SLUG = DEFAULT_CHALLENGE_SLUG;

export const ONBOARDING_STORAGE_KEY = "nuzlocke-onboarding-step";
export const ONBOARDING_TRANSITION_KEY = "nuzlocke-onboarding-transition";
/** Survives App Router remounts while a tour is in progress. */
export const ONBOARDING_ACTIVE_KEY = "nuzlocke-onboarding-active";

/**
 * Mobile workspace panel the tour needs before measuring a step.
 * Dispatched as `ONBOARDING_PANEL_EVENT` so MobileWorkspace can open/close
 * Info/Feed without the tour importing UI modules.
 */
export const ONBOARDING_PANEL_EVENT = "nuzlocke-tour-panel";

export type OnboardingMobilePanel = "info" | "feed" | null;

export type OnboardingRoute = "trainer" | "season" | "setup";

export type OnboardingStep = {
  id: string;
  route: OnboardingRoute;
  /** CSS selector for spotlight; omit for a centered dark-overlay step. */
  element?: string;
  /**
   * On narrow viewports, open/close the mobile Info/Feed panel before the
   * spotlight is measured. `null` closes any open panel. Desktop ignores this
   * (the left rail already shows Info + tabs).
   */
  mobilePanel?: OnboardingMobilePanel;
  title: string;
  description: string;
  href: string;
  match: (pathname: string) => boolean;
};

export function requestOnboardingMobilePanel(panel: OnboardingMobilePanel) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_PANEL_EVENT, { detail: { panel } }),
  );
}

const slug = ONBOARDING_CHALLENGE_SLUG;
const base = `/challenges/${slug}`;

const trainerMatch = (pathname: string) =>
  pathname === `${base}/me` || pathname.startsWith(`${base}/trainers/`);

const seasonMatch = (pathname: string) =>
  pathname === base || pathname === `${base}/`;

const setupMatch = (pathname: string) =>
  pathname === `${base}/setup` || pathname.startsWith(`${base}/setup/`);

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    route: "trainer",
    title: "Welcome to the Trash Pack Season 2026 Nuzlocke Challenge!",
    description: "Let's get you situated.",
    href: `${base}/me`,
    match: trainerMatch,
  },
  {
    id: "player",
    route: "trainer",
    element: "[data-tour='player']",
    title: "This is you!",
    description:
      "In this season, you will be a Pokémon trainer going through the third generation Pokémon region — Hoenn.",
    href: `${base}/me`,
    match: trainerMatch,
  },
  {
    id: "pokemon",
    route: "trainer",
    element: "[data-tour='pokemon']",
    title: "This is where your Pokémon will be recorded",
    description:
      "You can import your save files to sync these entries with the Pokémon you've caught and trained in-game, or manually add them yourself!",
    href: `${base}/me`,
    match: trainerMatch,
  },
  {
    id: "season-trainers",
    route: "season",
    element: "[data-tour='tab-trainers']",
    // Close Info/Feed so the Trainers tab + board are what the user sees.
    mobilePanel: null,
    title: "Season 2026 trainers",
    description:
      "On the Season 2026 Trainers tab, you can see yourself alongside your fellow Trash Pack trainers' progress.",
    href: base,
    match: seasonMatch,
  },
  {
    id: "demo-trainer",
    route: "season",
    element: "[data-tour='demo-trainer']",
    mobilePanel: null,
    title: "By the end of your run…",
    description:
      "You'll want your entry to look something like this!",
    href: base,
    match: seasonMatch,
  },
  {
    id: "get-started-cta",
    route: "season",
    element: "[data-tour='cta-setup']",
    // CTA lives in General info — open the mobile Info panel first.
    mobilePanel: "info",
    title: "Explore more later",
    description:
      "When you're ready to play, hit Get Started — it'll walk you through the ROM, Afterplay, and importing your save.",
    href: base,
    match: seasonMatch,
  },
  {
    id: "setup",
    route: "setup",
    // Centered overlay on Get Started — Welcome video sits on the page behind it.
    title: "Here's where you'll start your Nuzlocke journey",
    description:
      "I'll leave it to Jason to take things from here.\nHope you guys have fun!\n— jawn",
    href: `${base}/setup`,
    match: setupMatch,
  },
];

export function readOnboardingStep(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= ONBOARDING_STEPS.length) {
      return 0;
    }
    return n;
  } catch {
    return 0;
  }
}

export function writeOnboardingStep(index: number) {
  try {
    sessionStorage.setItem(ONBOARDING_STORAGE_KEY, String(index));
  } catch {
    // ignore
  }
}

export function clearOnboardingStep() {
  try {
    sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readOnboardingActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(ONBOARDING_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeOnboardingActive(active: boolean) {
  try {
    if (active) {
      sessionStorage.setItem(ONBOARDING_ACTIVE_KEY, "1");
    } else {
      sessionStorage.removeItem(ONBOARDING_ACTIVE_KEY);
    }
  } catch {
    // ignore
  }
}

export function readOnboardingTransition(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(ONBOARDING_TRANSITION_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeOnboardingTransition(active: boolean) {
  try {
    if (active) {
      sessionStorage.setItem(ONBOARDING_TRANSITION_KEY, "1");
    } else {
      sessionStorage.removeItem(ONBOARDING_TRANSITION_KEY);
    }
  } catch {
    // ignore
  }
}

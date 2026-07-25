import { DEFAULT_CHALLENGE_SLUG } from "@/lib/constants-app";

/** Default season for first-run onboarding after Discord login. */
export const ONBOARDING_CHALLENGE_SLUG = DEFAULT_CHALLENGE_SLUG;

export type OnboardingStepId = "trainer" | "season" | "setup";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  body: string;
  /** Path to open for this step. */
  href: string;
  /** True when the current pathname belongs to this step. */
  match: (pathname: string) => boolean;
};

const slug = ONBOARDING_CHALLENGE_SLUG;
const base = `/challenges/${slug}`;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "trainer",
    title: "Your trainer board",
    body: "This is your Season 2026 profile. Set your handle and avatar, then use Import save once you have a file from Afterplay — party, boxes, and fainted mons map onto Main Squad, Reserves, and R.I.P.",
    href: `${base}/me`,
    match: (pathname) =>
      pathname === `${base}/me` ||
      pathname.startsWith(`${base}/trainers/`),
  },
  {
    id: "season",
    title: "Season 2026 & trainers",
    body: "The left rail has season info and the Pack feed. The main board lists every trainer in the league — peek at runs, compare boards, and cheer people on as the season unfolds.",
    href: base,
    match: (pathname) => pathname === base || pathname === `${base}/`,
  },
  {
    id: "setup",
    title: "Get started",
    body: "You're ready to play. Download the ROM, load it in Afterplay, export your save, then import it on your trainer board. Follow the steps on this page — the tour ends here so you can jump straight in.",
    href: `${base}/setup`,
    match: (pathname) =>
      pathname === `${base}/setup` || pathname.startsWith(`${base}/setup/`),
  },
];

export function onboardingStepIndex(pathname: string): number {
  return ONBOARDING_STEPS.findIndex((step) => step.match(pathname));
}

import Image from "next/image";
import type { Metadata } from "next";
import { Frame } from "@/components/Frame";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "About",
  description:
    "About Trash Pack's Nuzlocke Challenge Manager, Nuzlockes, and the Trash Pack crew.",
};

const TRASH_PACK_YT =
  "https://www.youtube.com/channel/UC0cYecpkXZgRGEPUjj8gl5Q";
const PROJECT_GITHUB = "https://github.com/tehjawn/nuzlocke-manager";
const MAINTAINER_GITHUB = "https://github.com/tehjawn";

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">About</h1>
        <p className="mt-2 text-muted">
          The project, the challenge format, and the crew behind the season.
        </p>

        <div className="mt-8 space-y-4">
          <Frame title="This project">
            <p className="text-sm leading-relaxed text-muted">
              Nuzlocke Manager is Trash Pack&apos;s home for league boards —
              squads, badges, memorials, and season archives in one place. Sign
              in with Discord, claim a trainer board, and keep the run visible
              for the whole pack.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Maintained by{" "}
              <a
                href={MAINTAINER_GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-accent-deep underline-offset-2 hover:underline"
              >
                @tehjawn
              </a>
              . Source and issues live on GitHub.
            </p>
            <a
              href={PROJECT_GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
            >
              View on GitHub →
            </a>
          </Frame>

          <Frame title="What is a Nuzlocke?">
            <p className="text-sm leading-relaxed text-muted">
              A Nuzlocke is a self-imposed Pokémon challenge built around
              permanence and restraint. The classic rules: you can only catch
              the first wild Pokémon you encounter in each area, and any Pokémon
              that faints is considered dead — boxed forever, never used again.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Leagues usually layer on house rules (dupes clause, level caps,
              nicknames) so every season feels distinct. This app tracks those
              runs so the story of the squad — wins, losses, and graves — stays
              with the group.
            </p>
          </Frame>

          <Frame title="Trash Pack">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Image
                src="/trash-pack-logo.png"
                alt="Trash Pack logo — raccoon in a pizza-box hat with a banana peel"
                width={112}
                height={112}
                className="mx-auto size-28 shrink-0 rounded-lg border border-frame sm:mx-0"
                priority
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-muted">
                  Trash Pack is a Philadelphia friends group of weebs, gamers,
                  and not-normies. We run annual Nuzlocke seasons, roast each
                  other&apos;s teams, and occasionally put the chaos on camera.
                </p>
                <a
                  href={TRASH_PACK_YT}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pressable mt-4 inline-block rounded-lg border-frame bg-surface px-4 py-2 text-sm font-semibold hover:border-interactive/50"
                >
                  Trash Pack on YouTube →
                </a>
              </div>
            </div>
          </Frame>
        </div>
      </main>
    </div>
  );
}

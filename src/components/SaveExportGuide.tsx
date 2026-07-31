"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/lib/cta";

type Shot = {
  src: string;
  alt: string;
  width: number;
  height: number;
  title: string;
  blurb: string;
};

const STEPS: Shot[] = [
  {
    src: "/setup/save-export/01-game-menu.png",
    alt: "Afterplay player chrome with a pink arrow pointing at the GAME MENU button",
    width: 1006,
    height: 704,
    title: "Open Game Menu",
    blurb:
      "While the ROM is running in Afterplay, tap GAME MENU in the top player bar.",
  },
  {
    src: "/setup/save-export/02-saves.png",
    alt: "Afterplay Game Menu Saves page with arrows pointing at Saves and the save state list",
    width: 1273,
    height: 1014,
    title: "Open Saves",
    blurb:
      "Choose Saves under Quick Access, then pick an Auto or Manual save state from the list.",
  },
  {
    src: "/setup/save-export/03-export.png",
    alt: "Afterplay save state context menu with Export highlighted by a pink arrow",
    width: 1183,
    height: 997,
    title: "Export the save state",
    blurb:
      "Right-click the save state to open its menu, then choose Export. That downloads the .sav / .srm file you’ll import on your trainer board.",
  },
];

/** Secondary CTA + modal walkthrough for exporting a save from Afterplay. */
export function SaveExportGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={CTA_SECONDARY}
        onClick={() => setOpen(true)}
      >
        How to export from Afterplay →
      </button>

      <Modal
        open={open}
        title="Export from Afterplay"
        subtitle="Game Menu → Saves → Export, then import on your trainer board."
        onClose={() => setOpen(false)}
        size="md"
      >
        <div className="space-y-6">
          <ol className="space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.src} className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-ink">
                    {index + 1}. {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {step.blurb}
                  </p>
                </div>
                <figure className="overflow-hidden rounded-lg border border-frame bg-surface-2">
                  <Image
                    src={step.src}
                    alt={step.alt}
                    width={step.width}
                    height={step.height}
                    className="h-auto w-full"
                    sizes="(max-width: 640px) 100vw, 36rem"
                  />
                </figure>
              </li>
            ))}
          </ol>

          <div className="space-y-2 border-t border-frame/40 pt-5">
            <button
              type="button"
              className={CTA_PRIMARY}
              onClick={() => setOpen(false)}
            >
              Got it!
            </button>
            <p className="text-sm leading-relaxed text-muted">
              Still don&apos;t get it? Message Oubori, jawn, or chedda!
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

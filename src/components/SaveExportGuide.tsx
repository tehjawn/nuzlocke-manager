import Image from "next/image";

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
      "Open the save state’s menu and choose Export. That file is what you’ll import on your trainer board.",
  },
];

/** Afterplay screenshot walkthrough for exporting a save on Get Started. */
export function SaveExportGuide() {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted">
        Afterplay path below. Other emulators work too — export a Gen&nbsp;3{" "}
        <code className="rounded-lg bg-surface-2 px-1 text-ink">.sav</code> /{" "}
        <code className="rounded-lg bg-surface-2 px-1 text-ink">.srm</code>{" "}
        instead, then continue with import.
      </p>

      <div className="space-y-8">
        {STEPS.map((step) => (
          <section key={step.src} className="space-y-3">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {step.blurb}
              </p>
            </div>
            <figure className="max-w-xl overflow-hidden rounded-lg border border-frame bg-surface-2">
              <Image
                src={step.src}
                alt={step.alt}
                width={step.width}
                height={step.height}
                className="h-auto w-full"
                sizes="(max-width: 640px) 100vw, 28rem"
              />
            </figure>
          </section>
        ))}
      </div>
    </div>
  );
}

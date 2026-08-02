import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Frame } from "@/components/Frame";
import { PreferencesForm } from "@/components/PreferencesForm";
import { SiteHeader, SITE_SHELL_MAX_CLASS } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Preferences",
};


export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main
        className={`mx-auto w-full flex-1 px-4 py-10 sm:px-6 ${SITE_SHELL_MAX_CLASS}`}
      >
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight">Preferences</h1>
          <p className="mt-2 text-muted">
            Choose how Nuzlocke Manager looks, sounds, and displays Pokémon.
          </p>
          <div className="mt-8">
            <Frame title="Player preferences">
              <PreferencesForm />
            </Frame>
          </div>
        </div>
      </main>
    </div>
  );
}

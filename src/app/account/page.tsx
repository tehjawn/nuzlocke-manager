import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountForm } from "@/components/AccountForm";
import { Frame } from "@/components/Frame";
import { SiteHeader } from "@/components/SiteHeader";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Account",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  let displayName = session.user.name ?? "";
  let bio = "";
  let image = session.user.image ?? "";

  if (isDatabaseConfigured() && session.user.id) {
    const user = await getPrisma().user.findUnique({
      where: { id: session.user.id },
    });
    if (user) {
      displayName = user.displayName ?? user.name ?? displayName;
      bio = user.bio ?? "";
      image = user.image ?? image;
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Account
        </h1>
        <p className="mt-2 text-muted">
          Edit how you appear across challenges.
        </p>
        <div className="mt-8">
          <Frame title="Profile">
            {isDatabaseConfigured() ? (
              <AccountForm
                displayName={displayName}
                bio={bio}
                image={image}
              />
            ) : (
              <p className="text-sm text-muted">
                Database required to save account changes.
              </p>
            )}
          </Frame>
        </div>
      </main>
    </div>
  );
}

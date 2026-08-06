import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

/**
 * Ask as a full-height right rail with rich answers (#300).
 *
 * Dashboard: https://vercel.com/tehjawns-projects/nuzlocke-manager/flag/ai-drawer
 * Kind: boolean · variants Off (false) / On (true)
 * Environments: production Off, preview Off, development On
 */
export const aiDrawerFlag = flag<boolean>({
  key: "ai-drawer",
  description:
    "Ask as a full-height right rail with rich answers (#300). Off keeps Ask inside Jump.",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  adapter: vercelAdapter(),
});

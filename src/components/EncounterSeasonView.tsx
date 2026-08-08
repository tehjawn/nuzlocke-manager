"use client";

import { EncounterRouteMap } from "@/components/EncounterRouteMap";
import type { EncounterRouteGroup } from "@/lib/encounter-ledger";
import type { PersonalRouteStatus } from "@/lib/personal-routes";

type EncounterSeasonViewProps = {
  groups: EncounterRouteGroup[];
  myTrainerId?: string | null;
  routeStatuses: PersonalRouteStatus[];
  slug: string;
};

/**
 * Catch Map tool surface — next-catch planner on the Hoenn map (former Encounters
 * ledger / my-routes / missing-dex tabs graduated elsewhere).
 */
export function EncounterSeasonView({
  groups,
  myTrainerId = null,
  routeStatuses,
  slug,
}: EncounterSeasonViewProps) {
  return (
    <EncounterRouteMap
      groups={groups}
      myTrainerId={myTrainerId}
      routeStatuses={routeStatuses}
      slug={slug}
    />
  );
}

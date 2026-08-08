export const MODERN_SAFARI_ZONE_AREAS = [
  { route: "Safari Zone (South)", encounterFlag: 0x33 },
  { route: "Safari Zone (Southwest)", encounterFlag: 0x34 },
  { route: "Safari Zone (Northwest)", encounterFlag: 0x35 },
  { route: "Safari Zone (North)", encounterFlag: 0x36 },
  { route: "Safari Zone (Southeast)", encounterFlag: 0x43 },
  { route: "Safari Zone (Northeast)", encounterFlag: 0x44 },
] as const;

export function modernSafariZoneAreasFromEncounterFlags(
  encounterFlags: Uint8Array,
): string[] {
  return MODERN_SAFARI_ZONE_AREAS.filter(({ encounterFlag }) => {
    const byte = encounterFlags[encounterFlag >> 3];
    return byte != null && (byte & (1 << (encounterFlag & 7))) !== 0;
  }).map(({ route }) => route);
}

/** Derive Safari area labels from already-decoded `NuzlockeEncounterFlags` bits. */
export function modernSafariZoneAreasFromUsedBits(
  usedBits: readonly number[],
): string[] {
  const bits = new Set(usedBits);
  return MODERN_SAFARI_ZONE_AREAS.filter(({ encounterFlag }) =>
    bits.has(encounterFlag),
  ).map(({ route }) => route);
}

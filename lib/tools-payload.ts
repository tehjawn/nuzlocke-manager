export interface ThinToolSlotPayload {
  id: string;
  species: string;
  status: string;
  location?: string;
}

export interface FullCompetitiveSlotPayload extends ThinToolSlotPayload {
  ivs: Record<string, number>;
  evs: Record<string, number>;
  moves: string[];
  ability: string;
  item?: string;
}

export function getToolShapedPayload<T extends ThinToolSlotPayload>(
  slots: T[],
  activeTool?: 'planner' | 'bounty' | 'markets' | 'itemdex'
): Partial<T>[] {
  if (activeTool === 'planner') {
    // Return full competitive payload only when team planner is active
    return slots;
  }

  // Thin payload for default / lightweight tools
  return slots.map(slot => ({
    id: slot.id,
    species: slot.species,
    status: slot.status,
    location: slot.location,
  }));
}

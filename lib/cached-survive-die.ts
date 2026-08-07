export interface SlimSurviveDieTally {
  pokemonId: string;
  surviveCount: number;
  dieCount: number;
}

const tallyCache = new Map<string, SlimSurviveDieTally>();

export async function getSlimSurviveDieTallies(
  pokemonIds: string[],
  fetchFromDb?: (ids: string[]) => Promise<SlimSurviveDieTally[]>
): Promise<SlimSurviveDieTally[]> {
  const missingIds = pokemonIds.filter(id => !tallyCache.has(id));

  if (missingIds.length > 0 && fetchFromDb) {
    const fetched = await fetchFromDb(missingIds);
    fetched.forEach(item => tallyCache.set(item.pokemonId, item));
  }

  return pokemonIds.map(
    id => tallyCache.get(id) || { pokemonId: id, surviveCount: 0, dieCount: 0 }
  );
}

export function invalidateSurviveDieTallyCache(pokemonId?: string) {
  if (pokemonId) {
    tallyCache.delete(pokemonId);
  } else {
    tallyCache.clear();
  }
}

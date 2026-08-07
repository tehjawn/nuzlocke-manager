import { getSlimSurviveDieTallies, invalidateSurviveDieTallyCache } from './cached-survive-die';

describe('Slim Survive/Die Tally Caching', () => {
  beforeEach(() => {
    invalidateSurviveDieTallyCache();
  });

  it('should fetch missing tallies from DB function and cache result', async () => {
    const mockDbFetch = jest.fn().mockResolvedValue([
      { pokemonId: 'pk_1', surviveCount: 10, dieCount: 2 },
    ]);

    const res1 = await getSlimSurviveDieTallies(['pk_1'], mockDbFetch);
    expect(res1[0].surviveCount).toBe(10);
    expect(mockDbFetch).toHaveBeenCalledTimes(1);

    // Second call uses warm cache
    const res2 = await getSlimSurviveDieTallies(['pk_1'], mockDbFetch);
    expect(res2[0].surviveCount).toBe(10);
    expect(mockDbFetch).toHaveBeenCalledTimes(1);
  });
});

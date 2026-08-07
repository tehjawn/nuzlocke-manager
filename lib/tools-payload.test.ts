import { getToolShapedPayload } from './tools-payload';

describe('Tools Payload Optimization', () => {
  const mockSlots = [
    {
      id: 'slot_1',
      species: 'Pikachu',
      status: 'active',
      location: 'Route 1',
      ivs: { hp: 31, atk: 31 },
      evs: { speed: 252 },
      moves: ['Thunderbolt', 'Quick Attack'],
      ability: 'Static',
    },
  ];

  it('should return thin payload by default for lightweight tools', () => {
    const thin = getToolShapedPayload(mockSlots, 'bounty');
    expect(thin[0]).toEqual({
      id: 'slot_1',
      species: 'Pikachu',
      status: 'active',
      location: 'Route 1',
    });
    expect((thin[0] as any).ivs).toBeUndefined();
  });

  it('should return full competitive payload when planner tool is active', () => {
    const full = getToolShapedPayload(mockSlots, 'planner');
    expect(full[0]).toHaveProperty('ivs');
    expect(full[0]).toHaveProperty('moves');
  });
});

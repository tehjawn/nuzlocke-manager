import learnsetsData from "@/data/modern-emerald-learnsets.json";

export type LevelUpMove = {
  level: number;
  move: string;
};

export type MachineMove = {
  machine: string;
  move: string;
};

export type ModernEmeraldLearnset = {
  egg: string[];
  levelUp: LevelUpMove[];
  tmHm: MachineMove[];
  tutor: string[];
};

function isLearnsetKey(key: string): key is keyof typeof learnsetsData.byDex {
  return Object.hasOwn(learnsetsData.byDex, key);
}

export function modernEmeraldLearnsetFor(
  pokedexId: number,
): ModernEmeraldLearnset | null {
  if (!Number.isInteger(pokedexId) || pokedexId <= 0) return null;
  const key = String(pokedexId);
  if (!isLearnsetKey(key)) return null;
  const learnset = learnsetsData.byDex[key];
  return {
    egg: [...learnset.egg],
    levelUp: learnset.levelUp.map(({ level, move }) => ({ level, move })),
    tmHm: learnset.tmHm.map(({ machine, move }) => ({ machine, move })),
    tutor: [...learnset.tutor],
  };
}

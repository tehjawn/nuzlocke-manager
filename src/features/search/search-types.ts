export type SearchCategory =
  | "navigate"
  | "trainer"
  | "pokemon"
  | "item"
  | "badge"
  | "rules"
  | "guide"
  | "action";

export type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  category: SearchCategory;
  /** Extra tokens for fuzzy matching (handles, species, routes, etc.). */
  tags: string[];
  /** Optional left icon URL (trainer avatar / Pokémon sprite). */
  imageUrl?: string;
  /** Pokémon image data resolved against the player's sprite preference. */
  pokemonSprite?: {
    pokedexId: number | null;
    shiny: boolean;
    species: string;
  };
  /**
   * Non-navigation command key. Board-bound verbs (`import-save`,
   * `export-team`) hand off via SearchProvider → TrainerBoard (#308).
   */
  action?:
    | "toggle-theme"
    | "open-ask"
    | "import-save"
    | "export-team"
    | "copy-board-link";
};

/** Jump → board modal handoff (#308). */
export type BoardJumpAction = "import-save" | "export-team";

export type SearchSeasonContext = {
  /** Challenge id when known — forwarded to Ask run logs (#394). */
  id?: string;
  slug: string;
  name: string;
  year: number;
  status: string;
  /** Season ROM / game label (e.g. Pokémon Modern Emerald). */
  game?: string | null;
  showGm: boolean;
  myTrainerId: string | null;
  /** First-run funnel (#183): limit Search to Setup + My Trainer. */
  firstRun?: boolean;
  trainers: Array<{
    id: string;
    handle: string;
    realName: string | null;
    discordUsername: string | null;
    discordDisplayName: string | null;
    avatarSpriteKey: string;
    earnedBadgeKeys: string[];
    statusText: string | null;
    pokemon: Array<{
      id: string;
      slot: string;
      nickname: string | null;
      species: string;
      pokedexId: number | null;
      isShiny: boolean;
      catchRoute: string | null;
      level: number | null;
    }>;
  }>;
  badges: Array<{
    key: string;
    label: string;
    category: string;
    leaderName?: string | null;
  }>;
  rules: Array<{ id: string; title: string | null; body: string }>;
  faqs: Array<{ id: string; question: string; answer: string }>;
};

export type SearchFuseHit = {
  item: SearchResult;
};

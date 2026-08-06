/** Client-safe Survive/Die poll types (issue #189). */

export type SurvivalPrediction = "SURVIVE" | "DIE";

export type SurvivalMarketStatus =
  | "OPEN"
  | "RESOLVED_SURVIVE"
  | "RESOLVED_DIE"
  | "VOID";

/** Slim tally for board chips — attached onto PokemonEntry when votes exist. */
export type SurvivalPollTally = {
  marketId: string;
  status: SurvivalMarketStatus;
  survive: number;
  die: number;
  total: number;
  /** Viewer's prediction when signed in and voted; omitted from shared cache. */
  myPrediction?: SurvivalPrediction | null;
};

export type SurvivalVoteUser = {
  id: string;
  displayName: string;
  image: string | null;
};

export type SurvivalVoteView = {
  id: string;
  prediction: SurvivalPrediction;
  comment: string | null;
  updatedAt: string;
  user: SurvivalVoteUser;
  /** Derived when market is resolved Survive/Die; null when OPEN/VOID. */
  correct: boolean | null;
};

export type SurvivalMarketView = {
  id: string;
  status: SurvivalMarketStatus;
  species: string;
  nickname: string | null;
  pokedexId: number | null;
  isShiny: boolean;
  survive: number;
  die: number;
  total: number;
  survivePct: number;
  resolvedAt: string | null;
  votes: SurvivalVoteView[];
  /** Resolved roster — empty when OPEN/VOID. */
  calledIt: SurvivalVoteView[];
  missed: SurvivalVoteView[];
  myPrediction: SurvivalPrediction | null;
  canVote: boolean;
  /** Why voting is blocked (signed out / non-member / closed / disabled). */
  voteBlockedReason: string | null;
};

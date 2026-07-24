import { z } from "zod";

export const UserRoleSchema = z.enum(["PLAYER", "GAME_MASTER"]);
export const ChallengeStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "TOURNAMENT",
  "ARCHIVED",
]);
export const PokemonSlotSchema = z.enum(["MAIN", "RESERVE", "GRAVEYARD"]);

export const PokemonEntryInputSchema = z.object({
  slot: PokemonSlotSchema,
  partyIndex: z.number().int().min(0).default(0),
  nickname: z.string().max(32).optional().nullable(),
  species: z.string().min(1).max(64),
  isShiny: z.boolean().default(false),
  types: z.array(z.string()).max(2).default([]),
  nature: z.string().max(32).optional().nullable(),
  level: z.number().int().min(1).max(100).optional().nullable(),
  ability: z.string().max(64).optional().nullable(),
  catchRoute: z.string().max(128).optional().nullable(),
  heldItem: z.string().max(64).optional().nullable(),
  moves: z.array(z.string().max(64)).max(4).default([]),
  causeOfDeath: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const TrainerBoardUpdateSchema = z.object({
  statusText: z.string().max(500).optional().nullable(),
  avatarSpriteKey: z.string().max(64).optional().nullable(),
  reviveUsed: z.boolean().optional(),
  handle: z.string().min(1).max(32).optional(),
  realName: z.string().max(64).optional().nullable(),
});

export const AccountUpdateSchema = z.object({
  displayName: z.string().min(1).max(64),
  bio: z.string().max(500).optional().nullable(),
  image: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export type PokemonEntryInput = z.infer<typeof PokemonEntryInputSchema>;
export type TrainerBoardUpdate = z.infer<typeof TrainerBoardUpdateSchema>;
export type AccountUpdate = z.infer<typeof AccountUpdateSchema>;

"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
  parsePokemonSaveAsync,
  type ParsedSavePokemon,
} from "@/lib/gen3-save";
import { pokemonSpriteUrl } from "@/lib/sprites";

export type SaveImportDraft = {
  pid: number;
  nickname: string;
  species: string;
  pokedexId: number;
  level: string;
  isShiny: boolean;
  slot: "MAIN" | "RESERVE";
  include: boolean;
};

type SaveImportModalProps = {
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onApply: (mons: SaveImportDraft[]) => void;
};

function toDrafts(pokemon: ParsedSavePokemon[]): SaveImportDraft[] {
  return pokemon.map((mon, i) => ({
    pid: mon.pid,
    nickname: mon.nickname ?? "",
    species: mon.species,
    pokedexId: mon.pokedexId,
    level: mon.level != null ? String(mon.level) : "",
    isShiny: mon.isShiny,
    slot: i < 6 ? "MAIN" : "RESERVE",
    include: true,
  }));
}

export function SaveImportModal({
  open,
  pending = false,
  onClose,
  onApply,
}: SaveImportModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<SaveImportDraft[] | null>(null);
  const [parsing, setParsing] = useState(false);

  if (!open) return null;

  function reset() {
    setError(null);
    setFormat(null);
    setWarnings([]);
    setDrafts(null);
    setParsing(false);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setError(null);
    setDrafts(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await parsePokemonSaveAsync(buf);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFormat(result.format);
      setWarnings(result.warnings);
      setDrafts(toDrafts(result.pokemon));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read save file");
    } finally {
      setParsing(false);
    }
  }

  const included = drafts?.filter((d) => d.include) ?? [];

  return (
    <Modal
      open={open}
      title="Import from save"
      wide
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="pressable rounded-sm border-2 border-frame bg-surface px-3 py-2 text-xs font-bold uppercase"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={!included.length || pending || parsing}
            className="pressable rounded-sm bg-accent px-3 py-2 text-xs font-bold text-white uppercase disabled:opacity-50"
            onClick={() => onApply(included)}
          >
            {pending ? "Saving…" : `Overwrite living roster (${included.length})`}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Upload an Afterplay save state (<code className="text-ink">save.state</code>
          ) or a Gen&nbsp;3 <code className="text-ink">.sav</code> /{" "}
          <code className="text-ink">.srm</code>. Preview the Pokémon, edit
          slots, then overwrite Main + Reserves. R.I.P. entries are kept.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Save file
          </span>
          <input
            type="file"
            accept=".state,.sav,.srm,.ss0,.ss1,.ss2,.ss3,.ss4,.ss5,.ss6,.ss7,.ss8,.ss9,application/octet-stream"
            disabled={parsing || pending}
            className="block w-full text-sm file:mr-3 file:rounded-sm file:border-2 file:border-frame file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {parsing ? <p className="text-muted">Reading save…</p> : null}
        {error ? (
          <p className="rounded-sm border-2 border-danger/40 bg-danger/10 px-3 py-2 text-danger">
            {error}
          </p>
        ) : null}
        {format ? (
          <p className="text-xs text-muted">
            Detected: {format}
            {warnings.length ? ` — ${warnings.join(" ")}` : ""}
          </p>
        ) : null}

        {drafts ? (
          <ul className="space-y-2">
            {drafts.map((mon, index) => (
              <li
                key={mon.pid}
                className={`flex flex-wrap items-center gap-3 rounded-sm border-2 border-frame bg-surface-2 p-2 ${
                  mon.include ? "" : "opacity-50"
                }`}
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mon.include}
                    onChange={(e) => {
                      const include = e.target.checked;
                      setDrafts((prev) =>
                        prev?.map((d, i) =>
                          i === index ? { ...d, include } : d,
                        ) ?? null,
                      );
                    }}
                  />
                  <Image
                    src={pokemonSpriteUrl(mon.species, {
                      shiny: mon.isShiny,
                      pokedexId: mon.pokedexId,
                    })}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="pixelated h-10 w-10"
                  />
                </label>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={mon.nickname}
                      placeholder="Nickname"
                      className="min-w-[6rem] flex-1 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
                      onChange={(e) => {
                        const nickname = e.target.value;
                        setDrafts((prev) =>
                          prev?.map((d, i) =>
                            i === index ? { ...d, nickname } : d,
                          ) ?? null,
                        );
                      }}
                    />
                    <input
                      value={mon.species}
                      placeholder="Species"
                      className="min-w-[7rem] flex-1 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
                      onChange={(e) => {
                        const species = e.target.value;
                        setDrafts((prev) =>
                          prev?.map((d, i) =>
                            i === index ? { ...d, species } : d,
                          ) ?? null,
                        );
                      }}
                    />
                    <input
                      value={mon.level}
                      placeholder="Lv"
                      inputMode="numeric"
                      className="w-14 rounded-sm border-2 border-frame bg-surface px-2 py-1 text-sm"
                      onChange={(e) => {
                        const level = e.target.value;
                        setDrafts((prev) =>
                          prev?.map((d, i) =>
                            i === index ? { ...d, level } : d,
                          ) ?? null,
                        );
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={mon.isShiny}
                        onChange={(e) => {
                          const isShiny = e.target.checked;
                          setDrafts((prev) =>
                            prev?.map((d, i) =>
                              i === index ? { ...d, isShiny } : d,
                            ) ?? null,
                          );
                        }}
                      />
                      Shiny
                    </label>
                    <select
                      value={mon.slot}
                      className="rounded-sm border-2 border-frame bg-surface px-2 py-1"
                      onChange={(e) => {
                        const slot = e.target.value as "MAIN" | "RESERVE";
                        setDrafts((prev) =>
                          prev?.map((d, i) =>
                            i === index ? { ...d, slot } : d,
                          ) ?? null,
                        );
                      }}
                    >
                      <option value="MAIN">Main Squad</option>
                      <option value="RESERVE">Reserves</option>
                    </select>
                    <span className="text-muted">#{mon.pokedexId}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  );
}

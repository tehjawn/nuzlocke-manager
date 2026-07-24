"use client";

import { useMemo, useState } from "react";
import { searchSpecies, type SpeciesInfo } from "@/data/species";

type SpeciesComboboxProps = {
  value: string;
  onChange: (species: string, meta?: SpeciesInfo) => void;
  id?: string;
};

export function SpeciesCombobox({
  value,
  onChange,
  id = "species",
}: SpeciesComboboxProps) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchSpecies(value, 8), [value]);

  return (
    <div className="relative">
      <input
        id={id}
        className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2 text-sm"
        value={value}
        autoComplete="off"
        placeholder="Start typing a species…"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // allow click
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-sm border-2 border-frame bg-surface shadow-[3px_3px_0_var(--shadow)]">
          {results.map((s) => (
            <li key={s.pokedexId}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent/15"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.name, s);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted">#{s.pokedexId}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

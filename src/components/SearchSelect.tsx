"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";

type SearchSelectProps = {
  value: string;
  onChange: (value: string) => void;
  search: (query: string, limit?: number) => string[];
  placeholder?: string;
  id?: string;
  limit?: number;
};

export function SearchSelect({
  value,
  onChange,
  search,
  placeholder = "Search…",
  id,
  limit = 12,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const deferred = useDeferredValue(value);
  const results = useMemo(
    () => search(deferred, limit),
    [deferred, limit, search],
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full rounded-sm border-2 border-frame bg-surface px-3 py-2"
          value={value}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {value ? (
          <button
            type="button"
            className="pressable shrink-0 rounded-sm bg-surface px-2 py-2 text-xs font-bold uppercase"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-sm border-2 border-frame bg-surface shadow-[3px_3px_0_var(--shadow)]"
        >
          {results.length > 0 ? (
            results.map((item) => (
              <li key={item} role="option" aria-selected={item === value}>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-accent/15"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  {item}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-muted">
              No matches — keep typing a custom value
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

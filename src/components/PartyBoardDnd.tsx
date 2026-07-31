"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Frame } from "@/components/Frame";
import { PokemonSlotCard } from "@/components/PokemonSlotCard";
import type { PokemonEntry, PokemonSlot } from "@/lib/challenge-types";
import {
  applyBoardItemsToPokemon,
  boardItemUpdates,
  buildBoardItems,
  emptyMainId,
  findBoardContainer,
  isDndSlot,
  isEmptyMainId,
  MAIN_PARTY_SIZE,
  type BoardItems,
  type DndSlot,
} from "@/lib/pokemon-board-dnd";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";

export type RelocateUpdate = {
  id: string;
  slot: PokemonSlot;
  partyIndex: number;
};

type PartyBoardDndProps = {
  pokemon: PokemonEntry[];
  mainSquadLocked: boolean;
  onSelect: (pokemon: PokemonEntry) => void;
  onSelectEmptyMain: (partyIndex: number) => void;
  onRelocate: (updates: RelocateUpdate[]) => boolean | Promise<boolean>;
  mainActions?: ReactNode;
  reservesActions?: ReactNode;
  graveyardActions?: ReactNode;
};

function normalizeMainItems(ids: string[]): string[] {
  const real: string[] = [];
  const placed = Array.from({ length: MAIN_PARTY_SIZE }, () => null as string | null);

  ids.forEach((id, i) => {
    if (isEmptyMainId(id)) return;
    if (real.includes(id)) return;
    if (i < MAIN_PARTY_SIZE && placed[i] == null) {
      placed[i] = id;
      real.push(id);
    }
  });

  for (const id of ids) {
    if (isEmptyMainId(id) || real.includes(id)) continue;
    const hole = placed.findIndex((x) => x == null);
    if (hole < 0) break;
    placed[hole] = id;
    real.push(id);
  }

  return placed.map((id, i) => id ?? emptyMainId(i));
}

function listWithoutEmpties(ids: string[]): string[] {
  return ids.filter((id) => !isEmptyMainId(id));
}

/** Move a card from one DnD section into another (used while dragging). */
function transferBetweenContainers(
  prev: BoardItems,
  activeId: string,
  from: DndSlot,
  to: DndSlot,
  overId: string,
): BoardItems {
  if (from === to) return prev;

  const source = [...prev[from]];
  const fromIndex = source.indexOf(activeId);
  if (fromIndex < 0) return prev;

  if (from === "MAIN") {
    source[fromIndex] = emptyMainId(fromIndex);
  } else {
    source.splice(fromIndex, 1);
  }

  if (to === "MAIN") {
    const main = [...prev.MAIN];
    let insertAt = main.indexOf(overId);
    if (overId === "MAIN" || insertAt < 0) {
      insertAt = main.findIndex((id) => isEmptyMainId(id));
      if (insertAt < 0) insertAt = MAIN_PARTY_SIZE - 1;
    }
    insertAt = Math.min(Math.max(insertAt, 0), MAIN_PARTY_SIZE - 1);

    // Active may still sit in MAIN when dragging MAIN → … → MAIN via another
    // container; clear any leftover copy before placing.
    for (let i = 0; i < main.length; i += 1) {
      if (main[i] === activeId) main[i] = emptyMainId(i);
    }

    const displaced = main[insertAt];
    main[insertAt] = activeId;

    let nextSource = source;
    if (displaced && !isEmptyMainId(displaced) && displaced !== activeId) {
      if (from === "MAIN") {
        const hole = nextSource.findIndex((id) => isEmptyMainId(id));
        if (hole >= 0) nextSource[hole] = displaced;
      } else {
        nextSource = [...source];
        nextSource.splice(Math.min(fromIndex, nextSource.length), 0, displaced);
      }
    }

    return {
      MAIN: normalizeMainItems(main),
      RESERVE:
        from === "RESERVE" ? listWithoutEmpties(nextSource) : prev.RESERVE,
      GRAVEYARD:
        from === "GRAVEYARD" ? listWithoutEmpties(nextSource) : prev.GRAVEYARD,
    };
  }

  const dest = [...prev[to]];
  // Dropping onto the section chrome appends; onto a card inserts at that card.
  let insertAt = dest.indexOf(overId);
  if (overId === to || insertAt < 0) insertAt = dest.length;
  dest.splice(insertAt, 0, activeId);

  return {
    MAIN: from === "MAIN" ? normalizeMainItems(source) : prev.MAIN,
    RESERVE:
      to === "RESERVE"
        ? listWithoutEmpties(dest)
        : from === "RESERVE"
          ? listWithoutEmpties(source)
          : prev.RESERVE,
    GRAVEYARD:
      to === "GRAVEYARD"
        ? listWithoutEmpties(dest)
        : from === "GRAVEYARD"
          ? listWithoutEmpties(source)
          : prev.GRAVEYARD,
  };
}

function SlotSectionDroppable({
  id,
  disabled,
  children,
}: {
  id: DndSlot;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
    data: { type: "container", slot: id },
  });
  return (
    <div
      ref={setNodeRef}
      className={
        isOver && !disabled
          ? "rounded-lg ring-2 ring-interactive/50 ring-offset-2 ring-offset-surface"
          : undefined
      }
    >
      {children}
    </div>
  );
}

function SortableSlot({
  id,
  pokemon,
  memorial,
  disabled,
  selectHint,
  onSelect,
  onSelectEmpty,
  shouldSuppressClick,
}: {
  id: string;
  pokemon: PokemonEntry | null;
  memorial?: boolean;
  disabled?: boolean;
  selectHint?: string;
  onSelect?: (pokemon: PokemonEntry) => void;
  onSelectEmpty?: () => void;
  shouldSuppressClick: () => boolean;
}) {
  const empty = isEmptyMainId(id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: disabled || empty,
    data: {
      type: empty ? "empty" : "pokemon",
      pokemon,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
  };

  // Empty MAIN slots stay a real <button> via PokemonSlotCard (not sortable).
  if (empty) {
    return (
      <div ref={setNodeRef} style={style} className="h-full min-h-0">
        <PokemonSlotCard
          pokemon={null}
          memorial={memorial}
          onSelect={onSelectEmpty}
        />
      </div>
    );
  }

  function activate() {
    if (!pokemon || !onSelect) return;
    if (shouldSuppressClick()) return;
    onSelect(pokemon);
  }

  const {
    onKeyDown: dndKeyDown,
    ...restListeners
  } = (listeners ?? {}) as {
    onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
    [key: string]: unknown;
  };

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    dndKeyDown?.(event);
    if (event.defaultPrevented || isDragging) return;
    // Space is reserved for keyboard sorting; Enter opens details.
    if (event.key === "Enter" && pokemon && onSelect) {
      event.preventDefault();
      activate();
    }
  }

  // Filled cards: one interactive surface (dnd-kit attributes) — do not nest a
  // <button> inside role="button".
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`h-full min-h-0 ${disabled ? "" : "touch-none cursor-grab active:cursor-grabbing"}`}
      {...(disabled
        ? { role: "button", tabIndex: 0 }
        : { ...attributes, ...restListeners })}
      onClick={activate}
      onKeyDown={handleKeyDown}
    >
      <PokemonSlotCard
        pokemon={pokemon}
        memorial={memorial}
        selectHint={onSelect ? selectHint : undefined}
        interactive={Boolean(onSelect)}
      />
    </div>
  );
}

function SortablePartyGrid({
  slot,
  items,
  pokemonById,
  memorial,
  fixedSlots,
  dragDisabled,
  selectHint,
  onSelect,
  onSelectEmpty,
  shouldSuppressClick,
}: {
  slot: DndSlot;
  items: string[];
  pokemonById: Map<string, PokemonEntry>;
  memorial?: boolean;
  fixedSlots?: number;
  dragDisabled?: boolean;
  selectHint?: string;
  onSelect: (pokemon: PokemonEntry) => void;
  onSelectEmpty?: (partyIndex: number) => void;
  shouldSuppressClick: () => boolean;
}) {
  return (
    <SortableContext
      id={slot}
      items={items}
      strategy={rectSortingStrategy}
      disabled={dragDisabled}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((id, index) => {
          const mon = isEmptyMainId(id) ? null : (pokemonById.get(id) ?? null);
          return (
            <SortableSlot
              key={id}
              id={id}
              pokemon={mon}
              memorial={memorial}
              disabled={dragDisabled}
              selectHint={selectHint}
              onSelect={onSelect}
              shouldSuppressClick={shouldSuppressClick}
              onSelectEmpty={
                fixedSlots != null && onSelectEmpty
                  ? () => onSelectEmpty(index)
                  : undefined
              }
            />
          );
        })}
      </div>
    </SortableContext>
  );
}

export function PartyBoardDnd({
  pokemon,
  mainSquadLocked,
  onSelect,
  onSelectEmptyMain,
  onRelocate,
  mainActions,
  reservesActions,
  graveyardActions,
}: PartyBoardDndProps) {
  // dnd-kit otherwise assigns its accessibility ID from a module-level counter,
  // which can differ between SSR and client hydration.
  const dndContextId = useId();
  const coarsePointer = useCoarsePointer();
  // Touch / phone UX fights scroll and accidental drags — tap-only there.
  const rearrangeDisabled = coarsePointer;
  const [items, setItems] = useState<BoardItems>(() => buildBoardItems(pokemon));
  const itemsRef = useRef(items);
  const aliveRef = useRef(true);
  const persistQueuedRef = useRef(false);
  const persistingRef = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  function commitItems(next: BoardItems) {
    itemsRef.current = next;
    setItems(next);
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: rearrangeDisabled ? Number.MAX_SAFE_INTEGER : 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const pokemonById = useMemo(
    () =>
      new Map(applyBoardItemsToPokemon(pokemon, items).map((p) => [p.id, p])),
    [pokemon, items],
  );

  const activePokemon =
    activeId && !isEmptyMainId(activeId)
      ? (pokemonById.get(activeId) ?? null)
      : null;

  async function flushPersistQueue() {
    if (persistingRef.current) {
      persistQueuedRef.current = true;
      return;
    }
    persistingRef.current = true;
    try {
      do {
        persistQueuedRef.current = false;
        const snapshot = itemsRef.current;
        const after = applyBoardItemsToPokemon(pokemon, snapshot);
        const updates = boardItemUpdates(pokemon, after);
        if (updates.length === 0) continue;
        const ok = await onRelocate(updates);
        if (!aliveRef.current) return;
        if (!ok) {
          commitItems(buildBoardItems(pokemon));
          // Drop any queued snapshot that was based on the failed layout.
          persistQueuedRef.current = false;
          return;
        }
      } while (persistQueuedRef.current && aliveRef.current);
    } finally {
      persistingRef.current = false;
    }
  }

  function persistItems() {
    void flushPersistQueue();
  }

  function suppressNextClick() {
    suppressClickRef.current = true;
    // Cross-section drops may not synthesize a card click — expire so the
    // next intentional tap is not swallowed.
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function consumeSuppressClick() {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }

  function resolveOverContainer(
    board: BoardItems,
    overId: string,
  ): DndSlot | undefined {
    return findBoardContainer(board, overId) ?? (isDndSlot(overId) ? overId : undefined);
  }

  function handleDragStart(event: DragStartEvent) {
    if (rearrangeDisabled) return;
    const id = String(event.active.id);
    if (isEmptyMainId(id)) return;
    if (
      mainSquadLocked &&
      findBoardContainer(itemsRef.current, id) === "MAIN"
    ) {
      return;
    }
    setActiveId(id);
  }

  function handleDragOver(event: DragOverEvent) {
    if (rearrangeDisabled) return;
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (isEmptyMainId(activeIdStr)) return;

    const prev = itemsRef.current;
    const from = findBoardContainer(prev, activeIdStr);
    const to = resolveOverContainer(prev, overIdStr);
    if (!from || !to || from === to) return;
    if (mainSquadLocked && (from === "MAIN" || to === "MAIN")) return;
    commitItems(
      transferBetweenContainers(prev, activeIdStr, from, to, overIdStr),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    if (rearrangeDisabled) {
      setActiveId(null);
      return;
    }
    const { active, over } = event;
    // Pointer sensors still emit a click after drag — don't open the modal.
    suppressNextClick();
    setActiveId(null);

    if (!over) {
      commitItems(buildBoardItems(pokemon));
      return;
    }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const current = itemsRef.current;
    const from = findBoardContainer(current, activeIdStr);
    const to = resolveOverContainer(current, overIdStr);

    if (!from || !to) {
      commitItems(buildBoardItems(pokemon));
      return;
    }

    if (mainSquadLocked && (from === "MAIN" || to === "MAIN")) {
      commitItems(buildBoardItems(pokemon));
      return;
    }

    if (from === to) {
      const list = [...current[from]];
      const oldIndex = list.indexOf(activeIdStr);
      let newIndex = list.indexOf(overIdStr);
      if (overIdStr === to) newIndex = list.length - 1;
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        const moved = arrayMove(list, oldIndex, newIndex);
        commitItems({
          ...current,
          [from]:
            from === "MAIN"
              ? normalizeMainItems(moved)
              : listWithoutEmpties(moved),
        });
      }
    }

    persistItems();
  }

  function handleDragCancel() {
    if (rearrangeDisabled) {
      setActiveId(null);
      return;
    }
    suppressNextClick();
    setActiveId(null);
    commitItems(buildBoardItems(pokemon));
  }

  const reservesCount = items.RESERVE.length;
  const graveyardCount = items.GRAVEYARD.length;
  const mainDragDisabled = rearrangeDisabled || mainSquadLocked;

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-6">
        <Frame title="Main Squad">
          <SlotSectionDroppable id="MAIN" disabled={mainDragDisabled}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {mainSquadLocked
                    ? "Main Squad is locked. Tap a Pokémon to view."
                    : rearrangeDisabled
                      ? "Tap a Pokémon to view or edit; empty slots to add."
                      : "Drag to reorder or move between sections. Tap to view or edit; empty slots to add."}
                </p>
                {mainActions}
              </div>
              <div data-tour="pokemon">
                <SortablePartyGrid
                  slot="MAIN"
                  items={items.MAIN}
                  pokemonById={pokemonById}
                  fixedSlots={MAIN_PARTY_SIZE}
                  dragDisabled={mainDragDisabled}
                  selectHint="View"
                  onSelect={onSelect}
                  onSelectEmpty={onSelectEmptyMain}
                  shouldSuppressClick={consumeSuppressClick}
                />
              </div>
            </div>
          </SlotSectionDroppable>
        </Frame>

        <Frame title="The Reserves">
          <SlotSectionDroppable id="RESERVE" disabled={rearrangeDisabled}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {reservesCount === 0
                    ? rearrangeDisabled
                      ? "No reserves yet."
                      : "No reserves yet — drag a Pokémon here."
                    : rearrangeDisabled
                      ? "Tap a Pokémon to view or edit."
                      : "Drag to reorder or move. Tap a Pokémon to view or edit."}
                </p>
                {reservesActions}
              </div>
              {reservesCount > 0 ? (
                <SortablePartyGrid
                  slot="RESERVE"
                  items={items.RESERVE}
                  pokemonById={pokemonById}
                  dragDisabled={rearrangeDisabled}
                  selectHint="View"
                  onSelect={onSelect}
                  shouldSuppressClick={consumeSuppressClick}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-frame/40 px-3 py-6 text-center text-sm text-muted">
                  {rearrangeDisabled
                    ? "Reserves will show up here."
                    : "Drop Pokémon here for the reserves."}
                </p>
              )}
            </div>
          </SlotSectionDroppable>
        </Frame>

        <Frame title="R.I.P." tone="rip">
          <SlotSectionDroppable id="GRAVEYARD" disabled={rearrangeDisabled}>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {graveyardCount === 0
                    ? rearrangeDisabled
                      ? "Memorial is empty."
                      : "Memorial is empty — drag a fallen Pokémon here."
                    : rearrangeDisabled
                      ? "Tap a Pokémon to view or edit."
                      : "Drag to reorder or move. Tap a Pokémon to view or edit."}
                </p>
                {graveyardActions}
              </div>
              {graveyardCount > 0 ? (
                <SortablePartyGrid
                  slot="GRAVEYARD"
                  items={items.GRAVEYARD}
                  pokemonById={pokemonById}
                  memorial
                  dragDisabled={rearrangeDisabled}
                  selectHint="View"
                  onSelect={onSelect}
                  shouldSuppressClick={consumeSuppressClick}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-frame/40 px-3 py-6 text-center text-sm text-muted">
                  {rearrangeDisabled
                    ? "Fallen Pokémon will show up here."
                    : "Drop fallen Pokémon here."}
                </p>
              )}
            </div>
          </SlotSectionDroppable>
        </Frame>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePokemon ? (
          <div className="w-[min(100vw-2rem,20rem)] scale-[1.02] shadow-lg">
            <PokemonSlotCard pokemon={activePokemon} selectHint="Moving" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Ordered checklist / badge prefix fill (issue #309).
 *
 * Checking a later key also checks every key before it in `order`.
 * Unchecking removes only that key (no cascading clear).
 */

export function withOrderedPrefixCheck<T extends string>(
  order: readonly T[],
  currentKeys: readonly T[],
  toggledKey: T,
  checked: boolean,
): T[] {
  const set = new Set(currentKeys);
  if (!checked) {
    set.delete(toggledKey);
    return [...set];
  }

  const index = order.indexOf(toggledKey);
  if (index === -1) {
    set.add(toggledKey);
    return [...set];
  }

  for (let i = 0; i <= index; i++) {
    set.add(order[i]!);
  }
  return [...set];
}

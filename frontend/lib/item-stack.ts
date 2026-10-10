// Epic 7 (US 7.2) — the item dialog walks a stack of visited items so an
// alternative can be opened, explored further, and stepped back one level at
// a time. Kept pure so the navigation rules are unit-tested (ENV-08).

export function pushItem<T>(stack: readonly T[], item: T): T[] {
  return [...stack, item];
}

export function resetStack<T>(item: T): T[] {
  return [item];
}

export function clearStack<T>(): T[] {
  return [];
}

/** AC 7.2.2 / 7.2.3: step back exactly one level. */
export function popItem<T>(stack: readonly T[]): T[] {
  return stack.slice(0, -1);
}

export function topItem<T>(stack: readonly T[]): T | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/** The item named by the "Back to [previous item]" control. */
export function previousItem<T>(stack: readonly T[]): T | null {
  return stack.length > 1 ? stack[stack.length - 2] : null;
}

export function canGoBack<T>(stack: readonly T[]): boolean {
  return stack.length > 1;
}

/** Refresh the currently displayed item without disturbing the path back. */
export function replaceTop<T>(stack: readonly T[], item: T): T[] {
  return stack.length > 0 ? [...stack.slice(0, -1), item] : stack.slice();
}

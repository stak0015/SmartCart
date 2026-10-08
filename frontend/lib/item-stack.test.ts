import { describe, expect, it } from "vitest";

import {
  canGoBack,
  clearStack,
  popItem,
  previousItem,
  pushItem,
  replaceTop,
  resetStack,
  topItem,
} from "./item-stack";

describe("item dialog navigation stack", () => {
  it("starts empty and shows nothing", () => {
    const stack = clearStack<string>();
    expect(stack).toEqual([]);
    expect(topItem(stack)).toBeNull();
    expect(canGoBack(stack)).toBe(false);
  });

  it("opens a catalogue item as a fresh stack", () => {
    const stack = resetStack("original");
    expect(topItem(stack)).toBe("original");
    expect(canGoBack(stack)).toBe(false);
  });

  it("opens an alternative on top of the current item (AC 7.2.1)", () => {
    const stack = pushItem(resetStack("original"), "alternative");
    expect(topItem(stack)).toBe("alternative");
    expect(canGoBack(stack)).toBe(true);
    expect(previousItem(stack)).toBe("original");
  });

  it("returns to the previous item on Back (AC 7.2.2)", () => {
    const stack = popItem(pushItem(resetStack("original"), "alternative"));
    expect(topItem(stack)).toBe("original");
    expect(canGoBack(stack)).toBe(false);
    expect(previousItem(stack)).toBeNull();
  });

  it("walks back one level at a time through repeated exploration (AC 7.2.3)", () => {
    let stack = resetStack("original");
    stack = pushItem(stack, "alt-1");
    stack = pushItem(stack, "alt-2");
    expect(topItem(stack)).toBe("alt-2");
    expect(previousItem(stack)).toBe("alt-1");
    stack = popItem(stack);
    expect(topItem(stack)).toBe("alt-1");
    expect(previousItem(stack)).toBe("original");
    stack = popItem(stack);
    expect(topItem(stack)).toBe("original");
    expect(canGoBack(stack)).toBe(false);
  });

  it("never pops past the original item", () => {
    let stack = resetStack("original");
    stack = popItem(stack);
    stack = popItem(stack);
    expect(stack).toEqual([]);
  });

  it("refreshes the displayed item without losing the path back", () => {
    const stack = replaceTop(pushItem(resetStack("original"), "alternative"), "alternative-refreshed");
    expect(topItem(stack)).toBe("alternative-refreshed");
    expect(previousItem(stack)).toBe("original");
  });

  it("does not mutate the input stack", () => {
    const stack = Object.freeze(["original"]) as readonly string[];
    expect(() => pushItem(stack, "alternative")).not.toThrow();
    expect(stack).toEqual(["original"]);
  });
});

import { describe, expect, it } from "vitest";

import { cardSlot, deckLoop } from "./featured-deck-loop";

const MAX_WINGS = 3;
const LARGEST_DECK = 12;

function indicesOf(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

describe("featured deck loop", () => {
  it("is a whole number of copies of the product list", () => {
    for (let count = 2; count <= LARGEST_DECK; count += 1) {
      expect(deckLoop(count, MAX_WINGS).slots % count).toBe(0);
    }
  });

  it("never shows one product twice on stage at the same time", () => {
    for (let count = 2; count <= LARGEST_DECK; count += 1) {
      const loop = deckLoop(count, MAX_WINGS);

      expect(2 * loop.wings + 1).toBeLessThanOrEqual(count);
    }
  });

  it("keeps the wrap-around out of sight", () => {
    for (let count = 2; count <= LARGEST_DECK; count += 1) {
      const loop = deckLoop(count, MAX_WINGS);

      for (const slot of [0, 1, loop.slots - 2, loop.slots - 1]) {
        expect(Math.abs(slot - loop.centre)).toBeGreaterThan(loop.wings);
      }
    }
  });

  it("moves every card exactly one place toward the front each step", () => {
    for (let count = 2; count <= LARGEST_DECK; count += 1) {
      const loop = deckLoop(count, MAX_WINGS);

      for (const index of indicesOf(loop.slots)) {
        for (let step = 0; step < loop.slots; step += 1) {
          const before = cardSlot(index, step, loop);
          const after = cardSlot(index, step + 1, loop);

          expect(after).toBe((before - 1 + loop.slots) % loop.slots);
        }
      }
    }
  });

  it("centres the card that the caption describes at every step", () => {
    for (let count = 2; count <= LARGEST_DECK; count += 1) {
      const loop = deckLoop(count, MAX_WINGS);

      for (let step = 0; step < loop.slots; step += 1) {
        const centred = indicesOf(loop.slots).find(
          (index) => cardSlot(index, step, loop) === loop.centre,
        );

        expect(centred).toBe(step % loop.slots);
        expect((centred ?? -1) % count).toBe(step % count);
      }
    }
  });

  it("needs no ring for a single product", () => {
    expect(deckLoop(1, MAX_WINGS)).toEqual({ centre: 0, slots: 1, wings: 0 });
  });
});

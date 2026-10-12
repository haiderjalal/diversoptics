/**
 * Slot arithmetic for the featured deck's endless loop.
 *
 * The deck is a ring of `slots` positions. Each step moves every card one place
 * toward the front, and a card that passes the front re-enters at the back. The
 * ring always has at least two hidden positions at each end, so that re-entry
 * happens out of sight and no card ever travels across the visible deck.
 */

export interface DeckLoop {
  /** Positions in the ring: a whole multiple of the product count. */
  readonly slots: number;
  /** The position a centred card occupies. */
  readonly centre: number;
  /** Visible positions either side of the centre. */
  readonly wings: number;
}

/**
 * Sizes the ring for `productCount` products. The deck shows at most `maxWings`
 * either side of the centre, and fewer for a short list, so one product never
 * appears twice on stage at the same time.
 */
export function deckLoop(productCount: number, maxWings: number): DeckLoop {
  if (productCount < 2) {
    return { centre: 0, slots: Math.max(productCount, 0), wings: 0 };
  }

  const wings = Math.min(maxWings, Math.floor((productCount - 1) / 2));
  // Two hidden positions past the wings at each end keep the re-entry unseen.
  const minimum = 2 * wings + 6;
  const slots = Math.ceil(minimum / productCount) * productCount;

  return { centre: Math.floor(slots / 2), slots, wings };
}

/** The position of card `index` after the deck has moved `step` times. */
export function cardSlot(index: number, step: number, loop: DeckLoop): number {
  return mod(index + loop.centre - step, loop.slots);
}

/**
 * Whether a position is one of the two ends of the ring. A card only lands on an
 * end when it leaves the front or re-enters from the back, and both are hidden, so
 * the deck places it without a transition rather than sliding it across.
 */
export function isWrapSlot(slot: number, loop: DeckLoop): boolean {
  return slot === 0 || slot === loop.slots - 1;
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

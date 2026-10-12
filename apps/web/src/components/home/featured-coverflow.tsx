"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  focalObjectPosition,
  resolveImageUrl,
} from "@/features/catalog/domain/media";
import {
  formatAvailabilityLabel,
  formatPriceLabel,
} from "@/features/catalog/domain/price";
import type { ProductSummary } from "@/features/catalog/domain/types";

import { cardSlot, deckLoop, isWrapSlot } from "./featured-deck-loop";
import { ProductMediaPlaceholder } from "./product-media-placeholder";
import { useInView } from "./use-in-view";

/**
 * Time between steps. Each step moves every card one place, and the move takes
 * longer than this (see `.dx-flow-card`), so the deck is always settling into its
 * next position. Matches the approved featured-carousel timing: a 2 s cycle with a
 * 1.5 s move.
 */
const ADVANCE_MS = 2_000;

/** Cards visible either side of the centre when the list is long enough. */
const MAX_WINGS = 3;

/**
 * Where a card sits given how many places it is from the centre. The gap between
 * neighbours narrows as they recede, which is what makes the far cards bunch
 * into a deck instead of marching off the edge at a constant pitch.
 */
function transformFor(offset: number) {
  const distance = Math.abs(offset);

  if (distance === 0) {
    return "translate(-50%, -50%) translateX(0) translateZ(0) rotateY(0deg) scale(1)";
  }

  const side = Math.sign(offset);
  // The first step has to clear the centre card's own half-width plus the
  // turned card's projected half-width, or the neighbour just hides behind it.
  // Later steps add much less, which is what packs the far cards into a deck.
  const shift = 86 + (distance - 1) * 18; // per cent of the card's own width
  const depth = -(90 + (distance - 1) * 60);
  const scale = Math.max(0.66, 1 - distance * 0.06);

  return `translate(-50%, -50%) translateX(${side * shift}%) translateZ(${depth}px) rotateY(${-side * 46}deg) scale(${scale})`;
}

/**
 * An endless featured carousel. It keeps moving until a visitor pauses it or moves
 * focus into it, and it holds still for reduced motion, where the arrows still work.
 *
 * Card positions come from the ring in `featured-deck-loop.ts`, so a card that
 * leaves the front re-enters from the back out of sight. The motion itself is CSS:
 * React only advances the step, which moves the cards and updates the caption.
 */
export function FeaturedCoverflow({
  products,
}: {
  products: readonly ProductSummary[];
}) {
  const [step, setStep] = useState(0);
  const [pausedByVisitor, setPausedByVisitor] = useState(false);
  const [pausedByFocus, setPausedByFocus] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage);
  const count = products.length;
  const loop = deckLoop(count, MAX_WINGS);
  const moving =
    count > 1 && !reducedMotion && inView && !pausedByVisitor && !pausedByFocus;
  // Visual cues depend only on the visitor's choices, never on `inView`: that value
  // differs between the server and the first client render, so the markup must not.
  const motionCues =
    count > 1 && !reducedMotion && !pausedByVisitor && !pausedByFocus;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!moving) return;

    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % loop.slots);
    }, ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [loop.slots, moving]);

  if (count === 0) return null;

  const current = products[step % count];
  if (!current) return null;

  const priceLabel = formatPriceLabel(current);
  const move = (delta: number) =>
    setStep((position) => (position + delta + loop.slots) % loop.slots);

  return (
    <div
      className="dx-flow relative isolate overflow-hidden rounded-3xl bg-obsidian px-4 py-9 text-porcelain sm:px-8"
      onBlurCapture={() => setPausedByFocus(false)}
      onFocusCapture={() => setPausedByFocus(true)}
      ref={stage}
    >
      <div
        aria-hidden="true"
        className="dx-flow-sheen pointer-events-none absolute inset-y-0 left-0 -z-10 w-2/5"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(254,204,41,0.16)_0%,transparent_70%)]"
      />

      {/* The deck. The ring behind the cards turns slowly around the centre card. */}
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(24rem,80%)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orbit-gold/25"
        >
          <span className="dx-orbit-spin absolute inset-0 rounded-full">
            <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orbit-gold shadow-[0_0_18px_rgb(254_204_41/0.9)]" />
          </span>
        </span>

        {/* Perspective lives here so every card shares one vanishing point. */}
        <ul className="relative h-[clamp(15rem,46vw,22rem)] list-none p-0 [perspective:1400px]">
          {Array.from({ length: loop.slots }, (_, index) => {
            const product = products[index % count];
            if (!product) return null;

            const slot = cardSlot(index, step, loop);
            const offset = slot - loop.centre;
            const distance = Math.abs(offset);
            const isCentre = distance === 0;
            const onStage = distance <= loop.wings;
            const image = product.primaryImage;
            const source = resolveImageUrl(image);

            return (
              <li
                // A card away from the centre is decorative: it is taken out of
                // the accessibility tree and its button off the tab ring, so the
                // deck never traps a keyboard in slides nobody can read. The
                // arrows below are the keyboard route through.
                aria-hidden={!isCentre}
                className={`dx-flow-card absolute left-1/2 top-1/2 aspect-square w-[clamp(11rem,40vw,18rem)] overflow-hidden rounded-2xl bg-porcelain shadow-[0_30px_60px_rgb(0_0_0/0.45)] ring-1 ${isCentre ? "ring-orbit-gold/60" : "ring-porcelain/15"}`}
                key={index}
                style={{
                  opacity: onStage ? 1 : 0,
                  pointerEvents: onStage ? undefined : "none",
                  transform: transformFor(offset),
                  // A card that re-enters from the back is placed without sliding,
                  // because the end of the ring is out of sight.
                  transition: isWrapSlot(slot, loop) ? "none" : undefined,
                  zIndex: 50 - distance,
                }}
              >
                {image && source ? (
                  <Image
                    alt={isCentre ? image.altText : ""}
                    className="object-cover"
                    fill
                    sizes="(min-width: 768px) 18rem, 40vw"
                    src={source}
                    style={{ objectPosition: focalObjectPosition(image) }}
                  />
                ) : (
                  // Same designed placeholder as the catalog, so a card without a
                  // photograph reads as deliberate rather than as a blank frame.
                  <div className="absolute inset-0">
                    <ProductMediaPlaceholder />
                  </div>
                )}

                {/* Depth veil, so the far cards read as further away rather than merely smaller. */}
                <span
                  aria-hidden="true"
                  className="dx-flow-veil absolute inset-0 bg-obsidian"
                  style={{ opacity: isCentre ? 0 : 0.1 + distance * 0.09 }}
                />

                {!isCentre ? (
                  <button
                    className="absolute inset-0 h-full w-full cursor-pointer"
                    onClick={() => setStep(index)}
                    tabIndex={-1}
                    type="button"
                  >
                    <span className="sr-only">Show {product.name}</span>
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {/*
        One caption for whichever card is centred, rather than copy inside every
        card: the deck stays a deck, and there is only ever one set of product
        details on the page for a reader to land on.
      */}
      <div className="relative mt-7 text-center">
        <div className="dx-flow-caption" key={current.id}>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-orbit-gold">
            {current.eyebrow || current.categoryName}
          </p>
          <h3 className="mt-2 font-display text-[1.75rem] leading-tight sm:text-[2rem]">
            {current.name}
          </h3>
          <p className="mt-1 text-xs font-medium tracking-[0.08em] text-porcelain/60">
            {current.sku} · {formatAvailabilityLabel(current.availability)}
          </p>
          {priceLabel ? (
            <p className="mt-2 text-base font-semibold">{priceLabel}</p>
          ) : null}
        </div>

        <Link
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-orbit-gold px-6 text-sm font-semibold text-obsidian transition-colors hover:bg-orbit-gold/85"
          href={current.href as Route}
          prefetch={false}
        >
          View details
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            viewBox="0 0 24 24"
          >
            <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {motionCues ? (
        <span
          aria-hidden="true"
          className="mx-auto mt-6 block h-px w-24 overflow-hidden bg-porcelain/15"
        >
          {/*
            Restarts with every step, and again when the deck comes back into view,
            so the rule always shows how long until the next move.
          */}
          <span
            className="dx-flow-progress block h-full origin-left bg-orbit-gold"
            key={`${step}-${inView}`}
            style={{ animationDuration: `${ADVANCE_MS}ms` }}
          />
        </span>
      ) : null}

      {count > 1 ? (
        <div className="mt-7 flex items-center justify-center gap-4">
          <button
            aria-label="Show previous product"
            className="grid size-11 place-items-center rounded-full border border-porcelain/25 transition-colors hover:bg-porcelain/10"
            onClick={() => move(-1)}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
            >
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" />
            </svg>
          </button>

          <p className="text-xs font-semibold tracking-[0.14em] text-porcelain/70">
            {String((step % count) + 1).padStart(2, "0")} /{" "}
            {String(count).padStart(2, "0")}
          </p>

          <button
            aria-label="Show next product"
            className="grid size-11 place-items-center rounded-full border border-porcelain/25 transition-colors hover:bg-porcelain/10"
            onClick={() => move(1)}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
            >
              <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" />
            </svg>
          </button>

          {/* Motion can be paused and resumed. With reduced motion nothing moves, so the control is not shown. */}
          {reducedMotion ? null : (
            <button
              aria-label={
                pausedByVisitor
                  ? "Play featured arrivals"
                  : "Pause featured arrivals"
              }
              className="grid size-11 place-items-center rounded-full border border-porcelain/25 transition-colors hover:bg-porcelain/10"
              onClick={() => setPausedByVisitor((paused) => !paused)}
              type="button"
            >
              {pausedByVisitor ? (
                <svg
                  aria-hidden="true"
                  className="size-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M7 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L8.5 4.64A1 1 0 0 0 7 5.5Z" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  className="size-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect height="14" rx="1" width="4" x="6" y="5" />
                  <rect height="14" rx="1" width="4" x="14" y="5" />
                </svg>
              )}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

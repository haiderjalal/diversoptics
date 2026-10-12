"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { PointerEvent } from "react";
import { useRef, useState } from "react";

import {
  focalObjectPosition,
  resolveImageUrl,
} from "@/features/catalog/domain/media";
import type {
  CatalogBrand,
  CatalogImage,
} from "@/features/catalog/domain/types";

/** Size of the hover frame. Must match `.dx-brand-preview` in globals.css. */
const PREVIEW_WIDTH = 256;
const PREVIEW_HEIGHT = 320;

/** Keeps the frame just clear of the cursor rather than underneath it. */
const CURSOR_OFFSET = 28;

export type BrandCurtainItem = {
  brand: CatalogBrand;
  image: CatalogImage | null;
};

/** Keeps a frame of `span` inside `limit`, so it never leaves the stage. */
function fit(value: number, span: number, limit: number): number {
  return Math.min(Math.max(value, 0), Math.max(limit - span, 0));
}

/** CSS reads these two properties, so each move repaints one transform only. */
function placeFrame(stage: HTMLElement, x: number, y: number): void {
  stage.style.setProperty("--bc-x", `${x}px`);
  stage.style.setProperty("--bc-y", `${y}px`);
}

/**
 * The brand names as links, with a photograph that follows a mouse and opens
 * beside a keyboard-focused row. Touch never triggers it, so a phone sees the same
 * list with no hover state at all.
 *
 * The frame is `aria-hidden` and carries no text: the link it belongs to already
 * names the brand, so the preview adds nothing a screen reader should announce.
 */
export function BrandCurtainList({
  items,
}: {
  items: readonly BrandCurtainItem[];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const followPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;

    const stage = event.currentTarget;
    const box = stage.getBoundingClientRect();
    placeFrame(
      stage,
      fit(event.clientX - box.left + CURSOR_OFFSET, PREVIEW_WIDTH, box.width),
      fit(
        event.clientY - box.top - PREVIEW_HEIGHT / 2,
        PREVIEW_HEIGHT,
        box.height,
      ),
    );
  };

  // Keyboard focus has no pointer to follow, so the frame sits at the right-hand
  // edge of the stage, level with the focused row. Mouse clicks also focus a link,
  // which is why this only runs for keyboard focus.
  const placeBesideRow = (row: HTMLElement) => {
    const stage = stageRef.current;
    if (!stage || !row.matches(":focus-visible")) return;

    const box = stage.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    placeFrame(
      stage,
      fit(box.width, PREVIEW_WIDTH, box.width),
      fit(
        rowBox.top - box.top + rowBox.height / 2 - PREVIEW_HEIGHT / 2,
        PREVIEW_HEIGHT,
        box.height,
      ),
    );
  };

  return (
    <div
      className="dx-brand-stage relative"
      onPointerMove={followPointer}
      ref={stageRef}
    >
      <ul className="border-b border-porcelain/15">
        {items.map(({ brand }) => (
          <li className="border-t border-porcelain/15" key={brand.id}>
            <Link
              className="dx-brand-row group flex min-h-24 items-center justify-between gap-6 py-6 text-porcelain"
              href={brand.href as Route}
              onBlur={() => setActiveSlug(null)}
              onFocus={(event) => {
                placeBesideRow(event.currentTarget);
                setActiveSlug(brand.slug);
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setActiveSlug(brand.slug);
              }}
              onPointerLeave={() => setActiveSlug(null)}
              prefetch={false}
            >
              <span className="font-display text-[clamp(2.25rem,6vw,4.5rem)] leading-none tracking-[-0.02em]">
                {brand.name}
              </span>
              <span className="flex shrink-0 items-center gap-4">
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-porcelain/60 sm:block">
                  {brand.categoryLabel || "View products"}
                </span>
                <svg
                  aria-hidden="true"
                  className="dx-brand-arrow size-5 text-orbit-gold"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {items.map(({ brand, image }) => {
        const source = resolveImageUrl(image);

        // A brand with no photograph gets no frame. The orbit placeholder read as an
        // empty card, so the row stays a plain link instead.
        if (!image || !source) return null;

        return (
          <div
            aria-hidden="true"
            className="dx-brand-preview"
            data-open={activeSlug === brand.slug}
            key={brand.id}
          >
            <div className="dx-brand-frame">
              <div className="dx-brand-image">
                <Image
                  alt=""
                  className="dx-brand-photo object-cover"
                  fill
                  sizes={`${PREVIEW_WIDTH}px`}
                  src={source}
                  style={{ objectPosition: focalObjectPosition(image) }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

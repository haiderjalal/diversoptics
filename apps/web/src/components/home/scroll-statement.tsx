import type { CSSProperties } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The cover range runs from the heading entering at the bottom of the viewport to
 * it leaving at the top, so these percentages are scroll distance rather than
 * position on the page. The sentence is fully inked by the time it reaches about
 * a third of the way up the screen.
 */
const LIT_BY = 60;

/**
 * How much of the cover range one word takes. Words overlap their neighbours, so
 * the ink spreads across the sentence as a wave rather than word by word.
 */
const WORD_RANGE = 18;

/**
 * Renders a heading whose words darken from muted to full ink as the heading
 * scrolls into view. The scroll link lives in CSS (`.dx-statement`), so this needs
 * no script and never re-renders.
 *
 * Real spaces stay between the word spans, so the heading's accessible name is
 * still the plain sentence. Without scroll-driven animations, and for readers who
 * prefer less motion, every word stays at full ink.
 */
export function ScrollStatement({
  className,
  text,
}: {
  className?: string;
  text: string;
}) {
  const words = text.split(" ");
  const lastIndex = Math.max(words.length - 1, 1);

  return (
    <h2 className={cn("dx-statement", className)}>
      {words.map((word, index) => {
        const start = (index / lastIndex) * (LIT_BY - WORD_RANGE);
        const style = {
          "--dx-ink-start": `${start}%`,
          "--dx-ink-end": `${start + WORD_RANGE}%`,
        } as CSSProperties;

        return (
          <span className="dx-ink-word" key={`${index}-${word}`} style={style}>
            {word}
            {index < words.length - 1 ? " " : null}
          </span>
        );
      })}
    </h2>
  );
}

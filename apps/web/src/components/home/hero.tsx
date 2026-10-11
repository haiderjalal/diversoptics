import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { buildGeneralWhatsAppHref, siteConfig } from "@/lib/config/site";

import { SocialLinks } from "./social-links";

/**
 * Split by hand rather than by character count: each line animates up from its
 * own mask, and an automatic split would break the phrase in the wrong place.
 */
const HEADLINE_LINES = ["Find the pair", "that feels", "like yours."];

/**
 * A centred figure with the headline and the wordmark passing behind it.
 *
 * The layers are ordered by z-index rather than by document order, so the markup
 * can still read top to bottom on small screens:
 *
 *   z-0   wordmark, and the light behind the head
 *   z-10  headline
 *   z-20  the figure, which occludes both
 *   z-30  actions and social links, which must stay clickable
 *
 * The headline and the actions therefore live in two separate containers. One
 * container cannot hold both: it would form a single stacking context and
 * everything inside it would land on the same side of the figure.
 *
 * Below `lg` the overlap is dropped and the same parts stack in reading order,
 * because a portrait sitting on top of the text needs width to work.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="dx-hero group relative isolate min-h-[42rem] overflow-hidden bg-obsidian text-porcelain lg:min-h-[36rem]"
    >
      {/*
        The light behind the figure. This is what the graded portrait is lit to
        sit against: the rim on the hair reads as this source wrapping the head.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[6%] -z-10 aspect-square w-[min(46rem,96vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(254,204,41,0.20)_0%,rgba(168,121,42,0.11)_38%,transparent_68%)] blur-2xl lg:left-[53%] lg:top-[-14%] lg:w-[34rem]"
      />

      {/* The orbit device, the brand's signature graphic, framing the head. */}
      <div
        aria-hidden="true"
        className="dx-hero-ring pointer-events-none absolute left-1/2 top-[11%] -z-10 aspect-square w-[min(30rem,86vw)] -translate-x-1/2 rounded-full border border-orbit-gold/25 lg:left-[53%] lg:top-[1%] lg:w-[22rem]"
      >
        {/*
          Two bodies in orbit: a gold node on the outer ring and a brass node on the
          inner one, turning in opposite directions. Both only rotate, and the static
          rings are the complete picture for readers who prefer reduced motion.
        */}
        <div className="dx-orbit-spin absolute inset-0 rounded-full">
          <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orbit-gold shadow-[0_0_0_6px_rgb(254_204_41/0.12),0_0_22px_rgb(254_204_41/0.8)]" />
        </div>
        <div className="dx-orbit-spin-reverse absolute inset-[9%] rounded-full border border-antique-brass/20">
          <span className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-antique-brass" />
        </div>
      </div>

      {/* ------------------------------------------------------ z-10 headline */}
      <Container className="relative z-10 flex flex-col pt-10 lg:min-h-[36rem] lg:pt-10">
        <h1
          className="text-center font-display text-[clamp(3rem,12vw,4.75rem)] leading-[0.9] tracking-[-0.035em] lg:max-w-[45rem] lg:text-left lg:text-[clamp(4.75rem,8vw,7.5rem)]"
          id="hero-heading"
        >
          {HEADLINE_LINES.map((line, index) => (
            <span className="dx-line-mask" key={line}>
              <span
                className="dx-hero-line"
                style={{ "--dx-delay": `${160 + index * 110}ms` } as never}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>

        {/*
          On `lg` the intro sits right under the headline, measured from its
          last line. Below `lg` it moves down to the actions layer instead (see
          the duplicate near the bottom row) — there's no single element that
          can sit in both spots, since the two layers are separate stacking
          contexts for the figure-overlap trick above.
        */}
        <p className="dx-hero-fade hidden max-w-[19rem] text-sm leading-6 text-porcelain/70 lg:mt-7 lg:block lg:text-left">
          Browse the frames on the wall in F-11 Markaz, then ask the counter
          anything before you visit.
        </p>
      </Container>

      {/* -------------------------------------------------- z-20 figure + wordmark */}
      {/*
        Below `lg` the wordmark moves in here too, so it sits directly behind
        the figure instead of pinned to the section's bottom edge — with the
        intro paragraph now gone from the flow above, that fixed offset no
        longer lands behind the portrait, wherever it ends up on a given
        screen. `lg:contents` drops this wrapper from the box tree at `lg`, so
        the figure and wordmark go right back to being absolutely positioned
        against the section itself, exactly as before.
      */}
      <div className="relative lg:contents">
        <p
          aria-hidden="true"
          className="dx-hero-fade dx-wordmark-fade pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center whitespace-nowrap font-display text-[26vw] leading-[0.72] tracking-[-0.05em] text-porcelain/[0.09] lg:absolute lg:inset-auto lg:block lg:bottom-[8rem] lg:left-[53%] lg:right-auto lg:-translate-x-1/2 lg:text-center lg:text-[19rem]"
          style={{ "--dx-delay": "420ms" } as never}
        >
          <span className="dx-wordmark-drift inline-block">DIVERSO</span>
        </p>

        {/*
          One element, two behaviours: a normal block after the headline on small
          screens, an absolute centred layer on `lg`. Rendering it twice and
          toggling with `hidden` would preload the hero image twice, at two
          different widths, and only ever paint one of them.
        */}
        <div className="dx-hero-figure relative z-20 mx-auto mt-4 w-[min(24rem,84vw)] lg:absolute lg:bottom-[4rem] lg:left-[54%] lg:mt-0 lg:w-[min(36rem,42vw)] lg:-translate-x-1/2">
          {/*
            No parallax on this one. The drift is up to 6% of the figure height and
            it stacks on the CSS offset, which pushed the top of the hair through
            the section edge and clipped it flat once the figure sat this high.
          */}
          <div className="dx-fade-bottom relative aspect-[1046/911] w-full">
            <Image
              alt="A customer wearing aviator sunglasses from Diverso Optics"
              className="object-contain object-bottom"
              fill
              priority
              sizes="(min-width: 1024px) 576px, 384px"
              src="/brand/hero-portrait-silhouette.webp"
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------- z-30 actions and social row */}
      {/*
        Pulled back over the headline container with a negative margin so both
        occupy the same band without the section growing to twice its height.
        Pointer events are off on the spacer and back on for the controls, so the
        empty area never swallows a click meant for something underneath.
      */}
      <Container className="pointer-events-none relative z-30 mt-10 flex flex-col gap-8 pb-9 lg:-mt-[36rem] lg:min-h-[36rem] lg:justify-end lg:gap-0 lg:pb-6">
        {/*
          `flex-nowrap` from `lg` keeps the two actions on one line. They are
          narrow enough to fit and wrapping them read as a mistake rather than a
          stack.
        */}
        <div className="dx-hero-fade pointer-events-auto flex flex-wrap items-center justify-center gap-2 lg:flex-nowrap lg:justify-start">
          <Button asChild>
            <Link href="/eyewear/sunglasses">Browse sunglasses</Link>
          </Button>
          <Button
            asChild
            className="border border-porcelain/25 text-porcelain hover:bg-porcelain/10"
            tone="quiet"
          >
            <a href={buildGeneralWhatsAppHref()}>Ask on WhatsApp</a>
          </Button>
        </div>

        {/*
          Top right on `lg`, and back in the flow below it. `right-14` rather
          than `right-0` because an absolute child resolves against the
          container's padding box, so `right-0` would sit flush with the viewport
          edge and clip the label at narrower desktop widths.
        */}
        <div className="dx-hero-fade pointer-events-auto text-center lg:absolute lg:right-14 lg:top-10 lg:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-porcelain/75">
            Follow Diverso
          </p>
          <SocialLinks className="mt-3 justify-center lg:justify-end" />
        </div>

        {/* Below `lg` only — see the note by the headline for why this isn't one element. */}
        <p className="dx-hero-fade pointer-events-auto mx-auto max-w-[19rem] text-center text-sm leading-6 text-porcelain/70 lg:hidden">
          Browse the frames on the wall in F-11 Markaz, then ask the counter
          anything before you visit.
        </p>

        <div className="dx-hero-fade pointer-events-auto flex items-center justify-between gap-4 border-t border-porcelain/10 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-porcelain/75 lg:mt-8">
          <span>{siteConfig.locationLabel}</span>
          {/*
            The pulse rides the arrow, not the label. On the label its opacity
            trough drops the text under the AA contrast threshold, and axe
            samples the animation mid-cycle.
          */}
          <span className="hidden items-center gap-2 sm:inline-flex">
            Scroll
            <svg
              aria-hidden="true"
              className="dx-scroll-hint size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
            >
              <path d="M12 5v14m0 0-6-6m6 6 6-6" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </Container>
    </section>
  );
}

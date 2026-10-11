import type { CatalogCategory } from "@/features/catalog/domain/types";

/**
 * A slow ticker of the top-level categories, closing the dark hero. It repeats the
 * names the category panels below already link to, so it is decorative: hidden
 * from assistive technology, and removed for reduced motion rather than left as a
 * strip that cannot scroll.
 *
 * Two identical copies sit side by side. Moving the track by exactly half its width
 * lands on the same frame, which is what makes the loop seamless.
 */
export function CategoryMarquee({
  categories,
}: {
  categories: readonly CatalogCategory[];
}) {
  if (categories.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="dx-marquee hidden overflow-hidden border-y border-porcelain/10 bg-obsidian py-5 motion-safe:block"
    >
      <div className="dx-marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <ul className="flex shrink-0 items-center" key={copy}>
            {categories.map((category) => (
              <li className="flex items-center" key={`${copy}-${category.id}`}>
                <span className="font-display text-[2.25rem] leading-none tracking-[-0.01em] text-porcelain sm:text-[2.75rem]">
                  {category.name}
                </span>
                <span
                  aria-hidden="true"
                  className="mx-8 size-2.5 shrink-0 rounded-full bg-orbit-gold"
                />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

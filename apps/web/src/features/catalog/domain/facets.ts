import { AVAILABILITY_VALUES } from "./filters";
import type { Availability, CatalogFacet, CatalogFacets } from "./types";

/**
 * The product fields the facet counts need. The data layer reads one row per
 * product under the constraints every facet shares, and this module does the rest.
 */
export type FacetSourceRow = {
  availability: Availability;
  brandId: number | null;
  brandName: string | null;
  brandSlug: string | null;
};

/** The two selections a facet is not counted under. */
export type FacetSelection = {
  availability: readonly Availability[];
  brandIds: readonly number[] | null;
};

/**
 * Each facet is counted over the listing's scope minus its own dimension, so
 * selecting one brand still shows how many products the other brands hold. Both
 * facets come from one set of rows, filtered here rather than queried twice.
 */
export function deriveCatalogFacets(
  rows: readonly FacetSourceRow[],
  selection: FacetSelection,
): CatalogFacets {
  const brandRows = rows.filter(
    (row) =>
      selection.availability.length === 0 ||
      selection.availability.includes(row.availability),
  );

  const availabilityRows = rows.filter(
    (row) =>
      selection.brandIds === null ||
      (row.brandId !== null && selection.brandIds.includes(row.brandId)),
  );

  const brandCounts = new Map<
    number,
    { count: number; label: string; slug: string }
  >();

  for (const row of brandRows) {
    if (
      row.brandId === null ||
      row.brandName === null ||
      row.brandSlug === null
    )
      continue;

    const existing = brandCounts.get(row.brandId);

    brandCounts.set(row.brandId, {
      count: (existing?.count ?? 0) + 1,
      label: row.brandName,
      slug: row.brandSlug,
    });
  }

  const brands: CatalogFacet[] = [...brandCounts.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );

  const availabilityCounts = new Map<Availability, number>();

  for (const row of availabilityRows) {
    availabilityCounts.set(
      row.availability,
      (availabilityCounts.get(row.availability) ?? 0) + 1,
    );
  }

  const availability: CatalogFacet[] = AVAILABILITY_VALUES.flatMap((value) => {
    const count = availabilityCounts.get(value) ?? 0;

    return count > 0 ? [{ count, label: value, slug: value }] : [];
  });

  return { availability, brands };
}

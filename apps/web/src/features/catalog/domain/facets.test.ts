import { describe, expect, it } from "vitest";

import { deriveCatalogFacets, type FacetSourceRow } from "./facets";

const rows: FacetSourceRow[] = [
  {
    availability: "in_store",
    brandId: 1,
    brandName: "Chopard",
    brandSlug: "chopard",
  },
  {
    availability: "in_store",
    brandId: 1,
    brandName: "Chopard",
    brandSlug: "chopard",
  },
  {
    availability: "ask",
    brandId: 2,
    brandName: "Versace",
    brandSlug: "versace",
  },
  {
    availability: "out_of_stock",
    brandId: 2,
    brandName: "Versace",
    brandSlug: "versace",
  },
  { availability: "in_store", brandId: null, brandName: null, brandSlug: null },
];

const unfiltered = { availability: [], brandIds: null };

describe("deriveCatalogFacets", () => {
  it("counts over the whole scope when nothing is selected", () => {
    expect(deriveCatalogFacets(rows, unfiltered)).toEqual({
      availability: [
        { count: 3, label: "in_store", slug: "in_store" },
        { count: 1, label: "out_of_stock", slug: "out_of_stock" },
        { count: 1, label: "ask", slug: "ask" },
      ],
      brands: [
        { count: 2, label: "Chopard", slug: "chopard" },
        { count: 2, label: "Versace", slug: "versace" },
      ],
    });
  });

  it("leaves the availability facet alone when an availability is selected", () => {
    const facets = deriveCatalogFacets(rows, {
      availability: ["in_store"],
      brandIds: null,
    });

    // The brand counts narrow to in-store products; availability still shows all.
    expect(facets.brands).toEqual([
      { count: 2, label: "Chopard", slug: "chopard" },
    ]);
    expect(facets.availability).toEqual([
      { count: 3, label: "in_store", slug: "in_store" },
      { count: 1, label: "out_of_stock", slug: "out_of_stock" },
      { count: 1, label: "ask", slug: "ask" },
    ]);
  });

  it("leaves the brand facet alone when brands are selected", () => {
    const facets = deriveCatalogFacets(rows, {
      availability: [],
      brandIds: [2],
    });

    // Availability narrows to the selected brand; brands still show every brand.
    expect(facets.availability).toEqual([
      { count: 1, label: "out_of_stock", slug: "out_of_stock" },
      { count: 1, label: "ask", slug: "ask" },
    ]);
    expect(facets.brands).toEqual([
      { count: 2, label: "Chopard", slug: "chopard" },
      { count: 2, label: "Versace", slug: "versace" },
    ]);
  });

  it("applies both selections to the facet each one does not narrow", () => {
    const facets = deriveCatalogFacets(rows, {
      availability: ["ask", "out_of_stock"],
      brandIds: [2],
    });

    expect(facets.brands).toEqual([
      { count: 2, label: "Versace", slug: "versace" },
    ]);
    expect(facets.availability).toEqual([
      { count: 1, label: "out_of_stock", slug: "out_of_stock" },
      { count: 1, label: "ask", slug: "ask" },
    ]);
  });

  it("keeps products without a brand in the availability counts only", () => {
    const facets = deriveCatalogFacets(
      [
        {
          availability: "ask",
          brandId: null,
          brandName: null,
          brandSlug: null,
        },
      ],
      unfiltered,
    );

    expect(facets.brands).toEqual([]);
    expect(facets.availability).toEqual([
      { count: 1, label: "ask", slug: "ask" },
    ]);
  });
});

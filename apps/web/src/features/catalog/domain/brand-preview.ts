import type { CatalogImage, ProductSummary } from "./types";

/**
 * The hover preview for a brand is one of its own product photographs. A brand
 * with no featured product carrying an image gets `null`, and the interface shows
 * its placeholder instead of borrowing a photograph of a different brand.
 */
export function brandPreviewImage(
  brandSlug: string,
  products: readonly ProductSummary[],
): CatalogImage | null {
  const match = products.find(
    (product) =>
      product.brandSlug === brandSlug && product.primaryImage !== null,
  );

  return match?.primaryImage ?? null;
}

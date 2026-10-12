import type { CatalogImage, ProductSummary } from "./types";

/**
 * How many published products the storefront reads to find a photograph for each
 * brand. Featured products sort first, and the cap keeps the homepage read bounded
 * as the catalog grows.
 */
export const BRAND_PREVIEW_PRODUCT_LIMIT = 300;

/**
 * The hover preview for a brand is one of its own product photographs, taken from
 * the first product of that brand that has one. A brand with no such product gets
 * `null` and shows no frame, rather than borrowing a photograph of another brand.
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

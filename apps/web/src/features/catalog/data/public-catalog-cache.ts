import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import type { CatalogRepository } from "../domain/types";

/**
 * Public catalog data is identical for every anonymous visitor. Keeping a
 * durable data-cache entry prevents dynamic filter pages and route handlers
 * from repeating the same Supabase reads on every request.
 */
export const PUBLIC_CATALOG_CACHE_TAG = "public-catalog";

const CACHE_OPTIONS = {
  // This is a safety net. CMS writes invalidate the tag immediately below, so
  // normal edits do not wait an hour to appear on the storefront.
  revalidate: 3_600,
  tags: [PUBLIC_CATALOG_CACHE_TAG],
};

export function cachePublicCatalogRepository(
  repository: CatalogRepository,
): CatalogRepository {
  return {
    getAllProductSlugs: unstable_cache(
      () => repository.getAllProductSlugs(),
      ["public-catalog", "product-slugs"],
      CACHE_OPTIONS,
    ),
    getBrandBySlug: unstable_cache(
      (slug: string) => repository.getBrandBySlug(slug),
      ["public-catalog", "brand"],
      CACHE_OPTIONS,
    ),
    getBrandPreviewProducts: unstable_cache(
      () => repository.getBrandPreviewProducts(),
      ["public-catalog", "brand-preview-products"],
      CACHE_OPTIONS,
    ),
    getBrands: unstable_cache(
      () => repository.getBrands(),
      ["public-catalog", "brands"],
      CACHE_OPTIONS,
    ),
    getCategories: unstable_cache(
      () => repository.getCategories(),
      ["public-catalog", "categories"],
      CACHE_OPTIONS,
    ),
    getCategoryByPath: unstable_cache(
      (segments: readonly string[]) => repository.getCategoryByPath(segments),
      ["public-catalog", "category-path"],
      CACHE_OPTIONS,
    ),
    getCategoryTree: unstable_cache(
      () => repository.getCategoryTree(),
      ["public-catalog", "category-tree"],
      CACHE_OPTIONS,
    ),
    getCollectionBySlug: unstable_cache(
      (slug: string) => repository.getCollectionBySlug(slug),
      ["public-catalog", "collection"],
      CACHE_OPTIONS,
    ),
    getCollections: unstable_cache(
      () => repository.getCollections(),
      ["public-catalog", "collections"],
      CACHE_OPTIONS,
    ),
    getFeaturedBrands: unstable_cache(
      () => repository.getFeaturedBrands(),
      ["public-catalog", "featured-brands"],
      CACHE_OPTIONS,
    ),
    getFeaturedProducts: unstable_cache(
      () => repository.getFeaturedProducts(),
      ["public-catalog", "featured-products"],
      CACHE_OPTIONS,
    ),
    getPageBySlug: unstable_cache(
      (slug: string) => repository.getPageBySlug(slug),
      ["public-catalog", "editorial-page"],
      CACHE_OPTIONS,
    ),
    getPages: unstable_cache(
      (kind: string) => repository.getPages(kind),
      ["public-catalog", "editorial-pages"],
      CACHE_OPTIONS,
    ),
    getProductBySlug: unstable_cache(
      (slug: string) => repository.getProductBySlug(slug),
      ["public-catalog", "product"],
      CACHE_OPTIONS,
    ),
    getProductsBySlugs: unstable_cache(
      (slugs: readonly string[]) => repository.getProductsBySlugs(slugs),
      ["public-catalog", "products-by-slug"],
      CACHE_OPTIONS,
    ),
    listProducts: unstable_cache(
      (request) => repository.listProducts(request),
      ["public-catalog", "product-list"],
      CACHE_OPTIONS,
    ),
  };
}

/** Mark public catalog data stale without deleting the last good response. */
export function revalidatePublicCatalog(): void {
  revalidateTag(PUBLIC_CATALOG_CACHE_TAG, "max");
}

import { BRAND_PREVIEW_PRODUCT_LIMIT } from "../domain/brand-preview";
import {
  buildCategoryTree,
  collectCategoryIds,
  findCategoryById,
  findCategoryByPath,
  flattenCategories,
  type CategoryInput,
} from "../domain/categories";
import { CATALOG_PAGE_SIZE } from "../domain/filters";
import type {
  Availability,
  CatalogBrand,
  CatalogCollection,
  CatalogFacet,
  CatalogPage,
  CatalogRepository,
  EditorialPage,
  ProductAttributeValue,
  ProductDetail,
  ProductSummary,
  ProductVariantOption,
} from "../domain/types";

export type InMemoryProduct = ProductSummary & {
  attributes: readonly ProductAttributeValue[];
  categoryId: string;
  collectionSlugs: readonly string[];
  description: string;
  variants: readonly ProductVariantOption[];
};

export type InMemoryCatalogData = {
  brands: readonly CatalogBrand[];
  categories: readonly CategoryInput[];
  collections: readonly CatalogCollection[];
  pages: readonly EditorialPage[];
  products: readonly InMemoryProduct[];
};

const AVAILABILITIES: readonly Availability[] = [
  "in_store",
  "available_to_order",
  "out_of_stock",
  "ask",
];

/**
 * Built field by field rather than by spreading, so the fixture-only extras
 * (`categoryId`, `collectionSlugs`, `variants`, …) cannot leak into a summary and
 * quietly diverge from what the Supabase adapter returns.
 */
function toSummary(product: InMemoryProduct): ProductSummary {
  return {
    availability: product.availability,
    brandName: product.brandName,
    brandSlug: product.brandSlug,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    currency: product.currency,
    demo: product.demo,
    eyebrow: product.eyebrow,
    featured: product.featured,
    href: product.href,
    id: product.id,
    modelNumber: product.modelNumber,
    name: product.name,
    price: product.price,
    priceMode: product.priceMode,
    primaryImage: product.primaryImage,
    shortDescription: product.shortDescription,
    sku: product.sku,
    slug: product.slug,
    status: product.status,
  };
}

function matchesQuery(product: InMemoryProduct, query: string): boolean {
  const haystack = [
    product.name,
    product.sku,
    product.modelNumber,
    product.shortDescription ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

/**
 * A fixture-backed repository that reproduces the Supabase adapter's filtering,
 * sorting, paging and facet semantics. It keeps local and preview environments
 * exercising the same interface the production catalog uses, and gives the
 * listing logic a deterministic target for unit tests without a database.
 */
export function createInMemoryCatalogRepository(
  data: InMemoryCatalogData,
): CatalogRepository {
  const tree = buildCategoryTree(data.categories);
  const flat = flattenCategories(tree);

  function scopedProducts(request: {
    brandSlug?: string;
    categoryIds?: readonly string[];
    collectionSlug?: string;
    featuredOnly?: boolean;
  }): readonly InMemoryProduct[] {
    return data.products.filter((product) => {
      if (product.status !== "published") return false;

      if (
        request.categoryIds &&
        !request.categoryIds.includes(product.categoryId)
      ) {
        return false;
      }

      if (request.featuredOnly && !product.featured) return false;

      if (request.brandSlug && product.brandSlug !== request.brandSlug) {
        return false;
      }

      if (
        request.collectionSlug &&
        !product.collectionSlugs.includes(request.collectionSlug)
      ) {
        return false;
      }

      return true;
    });
  }

  function facetsFor(
    scoped: readonly InMemoryProduct[],
    filters: {
      availability: readonly Availability[];
      brandSlugs: readonly string[];
      query: string | null;
    },
  ): CatalogPage["facets"] {
    // Each facet counts over the scope minus its own dimension, so selecting one
    // brand still shows how many products the other brands hold.
    const forBrands = scoped.filter(
      (product) =>
        (filters.availability.length === 0 ||
          filters.availability.includes(product.availability)) &&
        (!filters.query || matchesQuery(product, filters.query)),
    );

    const forAvailability = scoped.filter(
      (product) =>
        (filters.brandSlugs.length === 0 ||
          (product.brandSlug !== null &&
            filters.brandSlugs.includes(product.brandSlug))) &&
        (!filters.query || matchesQuery(product, filters.query)),
    );

    const brandCounts = new Map<string, { count: number; label: string }>();

    for (const product of forBrands) {
      if (!product.brandSlug) continue;

      const existing = brandCounts.get(product.brandSlug);

      brandCounts.set(product.brandSlug, {
        count: (existing?.count ?? 0) + 1,
        label: existing?.label ?? product.brandName ?? product.brandSlug,
      });
    }

    const brands: CatalogFacet[] = [...brandCounts.entries()]
      .map(([slug, { count, label }]) => ({ count, label, slug }))
      .sort((left, right) => left.label.localeCompare(right.label));

    const availability: CatalogFacet[] = AVAILABILITIES.flatMap((value) => {
      const count = forAvailability.filter(
        (product) => product.availability === value,
      ).length;

      return count > 0 ? [{ count, label: value, slug: value }] : [];
    });

    return { availability, brands };
  }

  return {
    async getAllProductSlugs() {
      return data.products
        .filter((product) => product.status === "published")
        .map((product) => product.slug);
    },

    async getBrandBySlug(slug) {
      return data.brands.find((brand) => brand.slug === slug) ?? null;
    },

    async getBrands() {
      return data.brands;
    },

    async getCategories() {
      return flat;
    },

    async getCategoryByPath(segments) {
      return findCategoryByPath(tree, segments);
    },

    async getCategoryTree() {
      return tree;
    },

    async getCollectionBySlug(slug) {
      return (
        data.collections.find((collection) => collection.slug === slug) ?? null
      );
    },

    async getCollections() {
      return data.collections;
    },

    async getFeaturedBrands() {
      return data.brands;
    },

    async getFeaturedProducts() {
      return data.products
        .filter((product) => product.status === "published" && product.featured)
        .slice(0, 8)
        .map(toSummary);
    },

    async getBrandPreviewProducts() {
      return data.products
        .filter((product) => product.status === "published")
        .sort((left, right) => Number(right.featured) - Number(left.featured))
        .slice(0, BRAND_PREVIEW_PRODUCT_LIMIT)
        .map(toSummary);
    },

    async getPageBySlug(slug) {
      return data.pages.find((page) => page.slug === slug) ?? null;
    },

    async getPages(kind) {
      return data.pages.filter((page) => page.kind === kind);
    },

    async getProductBySlug(slug) {
      const product = data.products.find(
        (entry) => entry.slug === slug && entry.status === "published",
      );

      if (!product) return null;

      const category = findCategoryById(tree, product.categoryId);

      return {
        ...toSummary(product),
        attributes: product.attributes,
        brandHref: product.brandSlug ? `/brands/${product.brandSlug}` : null,
        categoryHref: category?.href ?? null,
        description: product.description,
        images: [],
        publishedAt: null,
        updatedAt: new Date(0).toISOString(),
        variants: product.variants,
      } satisfies ProductDetail;
    },

    async getProductsBySlugs(slugs) {
      // The caller's order is the visitor's shortlist order and must be preserved.
      return slugs.flatMap((slug) => {
        const product = data.products.find(
          (entry) => entry.slug === slug && entry.status === "published",
        );

        return product ? [toSummary(product)] : [];
      });
    },

    async listProducts(request) {
      const pageSize = request.pageSize ?? CATALOG_PAGE_SIZE;
      const { filters } = request;
      const scoped = scopedProducts(request);

      const filtered = scoped.filter((product) => {
        if (
          filters.brandSlugs.length > 0 &&
          (product.brandSlug === null ||
            !filters.brandSlugs.includes(product.brandSlug))
        ) {
          return false;
        }

        if (
          filters.availability.length > 0 &&
          !filters.availability.includes(product.availability)
        ) {
          return false;
        }

        return !filters.query || matchesQuery(product, filters.query);
      });

      const sorted = filtered.slice().sort((left, right) => {
        switch (filters.sort) {
          case "price_asc":
          case "price_desc": {
            // A product with no price cannot be ranked against one that has a
            // price, so it sorts last in both directions rather than reading as
            // the cheapest or the most expensive item.
            const leftPrice = left.price;
            const rightPrice = right.price;

            if (leftPrice === null && rightPrice === null) return 0;
            if (leftPrice === null) return 1;
            if (rightPrice === null) return -1;

            return filters.sort === "price_asc"
              ? leftPrice - rightPrice
              : rightPrice - leftPrice;
          }
          case "newest":
            return right.id.localeCompare(left.id);
          default:
            if (left.featured !== right.featured) return left.featured ? -1 : 1;

            return right.id.localeCompare(left.id);
        }
      });

      const from = (filters.page - 1) * pageSize;

      return {
        facets: facetsFor(scoped, filters),
        page: filters.page,
        pageCount: Math.max(1, Math.ceil(sorted.length / pageSize)),
        pageSize,
        products: sorted.slice(from, from + pageSize).map(toSummary),
        total: sorted.length,
      };
    },
  };
}

export { collectCategoryIds };

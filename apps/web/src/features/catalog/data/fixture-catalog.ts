import type { CatalogRepository } from "../domain/types";
import {
  demoBrands,
  demoCategoryRows,
  demoCollections,
  demoPages,
  demoProducts,
} from "./demo-fixtures";
import { createInMemoryCatalogRepository } from "./in-memory-catalog";

/**
 * Kept free of any server-only import so the catalog contract stays unit
 * testable; the Supabase wiring lives in `catalog-repository.ts`.
 */
export function createFixtureCatalogRepository(): CatalogRepository {
  return createInMemoryCatalogRepository({
    brands: demoBrands,
    categories: demoCategoryRows,
    collections: demoCollections,
    pages: demoPages,
    products: demoProducts,
  });
}

/**
 * Answers every read without inventing content. Used when production has no
 * connected project, so the storefront is visibly empty instead of fictional.
 */
export const emptyCatalogRepository: CatalogRepository = {
  async getAllProductSlugs() {
    return [];
  },
  async getBrandBySlug() {
    return null;
  },
  async getBrands() {
    return [];
  },
  async getCategories() {
    return [];
  },
  async getCategoryByPath() {
    return null;
  },
  async getCategoryTree() {
    return [];
  },
  async getCollectionBySlug() {
    return null;
  },
  async getCollections() {
    return [];
  },
  async getFeaturedBrands() {
    return [];
  },
  async getFeaturedProducts() {
    return [];
  },
  async getBrandPreviewProducts() {
    return [];
  },
  async getPageBySlug() {
    return null;
  },
  async getPages() {
    return [];
  },
  async getProductBySlug() {
    return null;
  },
  async getProductsBySlugs() {
    return [];
  },
  async listProducts(request) {
    return {
      facets: { availability: [], brands: [] },
      page: request.filters.page,
      pageCount: 1,
      pageSize: request.pageSize ?? 24,
      products: [],
      total: 0,
    };
  },
};

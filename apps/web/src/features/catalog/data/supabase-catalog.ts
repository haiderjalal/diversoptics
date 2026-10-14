import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import {
  getPublicCatalogClient,
  type PublicCatalogClient,
} from "@/lib/supabase/public";

import { BRAND_PREVIEW_PRODUCT_LIMIT } from "../domain/brand-preview";
import {
  buildCategoryTree,
  findCategoryById,
  findCategoryByPath,
  flattenCategories,
  type CategoryInput,
} from "../domain/categories";
import { deriveCatalogFacets, type FacetSourceRow } from "../domain/facets";
import { CATALOG_PAGE_SIZE } from "../domain/filters";
import type {
  Availability,
  AttributeValueType,
  CatalogBrand,
  CatalogCategory,
  CatalogCategoryNode,
  CatalogCollection,
  CatalogImage,
  CatalogListRequest,
  CatalogRepository,
  EditorialPage,
  PriceMode,
  ProductAttributeValue,
  ProductDetail,
  ProductSummary,
  ProductVariantOption,
  PublishStatus,
} from "../domain/types";
import { PUBLIC_CATALOG_CACHE_TAG } from "./public-catalog-cache";

const PRODUCT_SUMMARY_SELECT =
  "id, slug, name, sku, model_number, eyebrow, short_description, price, price_mode, currency, availability, status, featured, published_at, brands(name, slug), categories(id, name, slug), product_media(id, public_path, alt_text, width, height, focal_x, focal_y, is_primary, sort_order, variant_id)";

const PRODUCT_DETAIL_SELECT =
  "id, slug, name, sku, model_number, eyebrow, short_description, description, price, price_mode, currency, availability, status, featured, published_at, updated_at, brands(name, slug), categories(id, name, slug), product_media(id, public_path, alt_text, width, height, focal_x, focal_y, is_primary, sort_order, variant_id), product_variants(id, name, sku, price, price_mode, availability, sort_order), product_attribute_values(value_text, value_number, value_boolean, value_json, variant_id, attribute_definitions(key, name, value_type, sort_order))";

const PAGE_SELECT = "slug, kind, title, excerpt, body_markdown";

/** Facet counts need only each product's brand and availability. */
const FACET_SELECT = "brand_id, availability, brands(name, slug)";

/**
 * Public catalog reads fail loudly. A silent empty result would be
 * indistinguishable from an unpublished catalog, and docs/04 requires a visible
 * data-error state rather than a page that quietly pretends to be empty.
 */
function unwrap<T>(
  result: { data: T; error: PostgrestError | null },
  context: string,
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }

  return result.data;
}

const PRICE_MODES: readonly PriceMode[] = [
  "fixed",
  "from",
  "on_inquiry",
  "hidden",
];

const AVAILABILITIES: readonly Availability[] = [
  "in_store",
  "available_to_order",
  "out_of_stock",
  "ask",
];

const PUBLISH_STATUSES: readonly PublishStatus[] = [
  "draft",
  "published",
  "archived",
];

const ATTRIBUTE_VALUE_TYPES: readonly AttributeValueType[] = [
  "text",
  "number",
  "boolean",
  "option",
  "multi_option",
];

/**
 * These columns are constrained text rather than Postgres enums, so a value is
 * narrowed instead of asserted. The fallbacks are the honest ones: "ask" invites
 * a conversation and "on_inquiry" never prints a price.
 */
function toPriceMode(value: string | null): PriceMode {
  return PRICE_MODES.find((mode) => mode === value) ?? "on_inquiry";
}

function toAvailability(value: string | null): Availability {
  return AVAILABILITIES.find((entry) => entry === value) ?? "ask";
}

function toPublishStatus(value: string | null): PublishStatus {
  return PUBLISH_STATUSES.find((entry) => entry === value) ?? "draft";
}

function toAttributeValueType(value: string): AttributeValueType {
  return ATTRIBUTE_VALUE_TYPES.find((entry) => entry === value) ?? "text";
}

export function productHref(slug: string): string {
  return `/products/${slug}`;
}

export function brandHref(slug: string): string {
  return `/brands/${slug}`;
}

export function collectionHref(slug: string): string {
  return `/collections/${slug}`;
}

type MediaRow = {
  alt_text: string;
  focal_x: number;
  focal_y: number;
  height: number;
  id: number;
  is_primary: boolean;
  public_path: string | null;
  sort_order: number;
  variant_id: number | null;
  width: number;
};

/**
 * Gallery order follows the CMS, but the approved primary derivative always leads
 * so a product page and its card agree on the first image.
 */
function toGallery(rows: readonly MediaRow[]): readonly CatalogImage[] {
  return rows
    .filter((row) => row.variant_id === null)
    .flatMap((row) =>
      row.public_path === null ? [] : [{ ...row, path: row.public_path }],
    )
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;

      return left.sort_order - right.sort_order;
    })
    .map((row): CatalogImage => ({
      altText: row.alt_text,
      focalX: row.focal_x,
      focalY: row.focal_y,
      height: row.height,
      id: String(row.id),
      path: row.path,
      width: row.width,
    }));
}

type SummaryRow = {
  availability: string;
  brands: { name: string; slug: string } | null;
  categories: { id: number; name: string; slug: string } | null;
  currency: string;
  eyebrow: string | null;
  featured: boolean;
  id: number;
  model_number: string;
  name: string;
  price: number | null;
  price_mode: string;
  product_media: readonly MediaRow[];
  published_at: string | null;
  short_description: string | null;
  sku: string;
  slug: string;
  status: string;
};

function mapProductSummary(row: SummaryRow): ProductSummary {
  const gallery = toGallery(row.product_media);

  return {
    availability: toAvailability(row.availability),
    brandName: row.brands?.name ?? null,
    brandSlug: row.brands?.slug ?? null,
    categoryName: row.categories?.name ?? null,
    categorySlug: row.categories?.slug ?? null,
    currency: row.currency,
    demo: false,
    // No editorial text is invented. When the CMS eyebrow is empty the card falls
    // back to a fact that already exists on the record.
    eyebrow: row.eyebrow ?? row.brands?.name ?? row.categories?.name ?? "",
    featured: row.featured,
    href: productHref(row.slug),
    id: String(row.id),
    modelNumber: row.model_number,
    name: row.name,
    price: row.price === null ? null : Number(row.price),
    priceMode: toPriceMode(row.price_mode),
    primaryImage: gallery[0] ?? null,
    shortDescription: row.short_description,
    sku: row.sku,
    slug: row.slug,
    status: toPublishStatus(row.status),
  };
}

type AttributeValueRow = {
  attribute_definitions: {
    key: string;
    name: string;
    sort_order: number;
    value_type: string;
  } | null;
  value_boolean: boolean | null;
  value_json: unknown;
  value_number: number | null;
  value_text: string | null;
  variant_id: number | null;
};

function formatAttributeValue(row: AttributeValueRow, valueType: string) {
  switch (valueType) {
    case "boolean":
      return row.value_boolean === null
        ? null
        : row.value_boolean
          ? "Yes"
          : "No";
    case "number":
      return row.value_number === null
        ? null
        : String(Number(row.value_number));
    case "multi_option": {
      if (!Array.isArray(row.value_json)) return null;

      const values = row.value_json
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);

      return values.length > 0 ? values.join(", ") : null;
    }
    default:
      return row.value_text?.trim() ? row.value_text.trim() : null;
  }
}

function mapAttributes(
  rows: readonly AttributeValueRow[],
): readonly ProductAttributeValue[] {
  const entries = rows.flatMap((row) => {
    const definition = row.attribute_definitions;

    if (!definition || row.variant_id !== null) return [];

    const displayValue = formatAttributeValue(row, definition.value_type);

    // An empty specification is omitted rather than rendered as a blank row,
    // which would read as missing data on an otherwise complete page.
    if (!displayValue) return [];

    return [
      {
        displayValue,
        key: definition.key,
        name: definition.name,
        sortOrder: definition.sort_order,
        valueType: toAttributeValueType(definition.value_type),
      },
    ];
  });

  return entries
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ displayValue, key, name, valueType }) => ({
      displayValue,
      key,
      name,
      valueType,
    }));
}

type VariantRow = {
  availability: string;
  id: number;
  name: string;
  price: number | null;
  price_mode: string | null;
  sort_order: number;
  sku: string;
};

function mapVariants(
  rows: readonly VariantRow[],
): readonly ProductVariantOption[] {
  return rows
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((row) => ({
      availability: toAvailability(row.availability),
      id: String(row.id),
      name: row.name,
      price: row.price === null ? null : Number(row.price),
      priceMode: row.price_mode === null ? null : toPriceMode(row.price_mode),
      sku: row.sku,
    }));
}

type ProductDetailRow = SummaryRow & {
  description: string | null;
  product_attribute_values: readonly AttributeValueRow[];
  product_variants: readonly VariantRow[];
  published_at: string | null;
  updated_at: string;
};

/**
 * The category path comes from the taxonomy the caller already holds, so a product
 * page never reads the categories table on its own behalf.
 */
function mapProductDetail(
  row: ProductDetailRow,
  categoryTree: readonly CatalogCategoryNode[],
): ProductDetail {
  const summary = mapProductSummary(row);
  const categoryId = row.categories?.id;
  const categoryNode =
    categoryId === undefined
      ? null
      : findCategoryById(categoryTree, String(categoryId));

  return {
    ...summary,
    attributes: mapAttributes(row.product_attribute_values),
    brandHref: summary.brandSlug ? brandHref(summary.brandSlug) : null,
    categoryHref: categoryNode?.href ?? null,
    description: row.description,
    images: toGallery(row.product_media),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    variants: mapVariants(row.product_variants),
  } satisfies ProductDetail;
}

/**
 * A free-text query reaches PostgREST's filter grammar, where commas, parentheses
 * and quotes are structural. Rather than escaping them the query is reduced to
 * characters that can legitimately appear in a product name, model or SKU.
 */
export function sanitizeSearchTerm(query: string): string {
  return query
    .replace(/[^\p{L}\p{N} .+_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function searchFilter(term: string): string {
  const pattern = `%${term}%`;

  // ilike across the identity columns gives the partial matching a visitor
  // expects while typing a model number. products.search_vector stays indexed for
  // a ranked upgrade once the catalog is large enough to need one.
  return [
    `name.ilike.${pattern}`,
    `sku.ilike.${pattern}`,
    `model_number.ilike.${pattern}`,
    `short_description.ilike.${pattern}`,
  ].join(",");
}

/**
 * A scope is resolved to plain values before any query is built, so the listing
 * query and both facet queries apply identical constraints without sharing a
 * builder type. `impossible` marks a scope whose brand, collection or category
 * does not exist in the published catalog: the caller shows an empty result
 * rather than falling back to the whole catalog under the wrong heading.
 */
type ResolvedScope = {
  availability: readonly Availability[];
  brandId: number | null;
  brandIds: readonly number[] | null;
  categoryIds: readonly number[] | null;
  featuredOnly: boolean;
  impossible: boolean;
  productIds: readonly number[] | null;
  searchTerm: string;
};

export function createSupabaseCatalogRepository(
  client: PublicCatalogClient,
): CatalogRepository {
  async function fetchCategoryRows(): Promise<readonly CategoryInput[]> {
    const data = unwrap(
      await client
        .from("categories")
        .select("id, name, slug, eyebrow, description, parent_id")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      "Could not load categories",
    );

    return (data ?? []).map((row) => ({
      demo: false,
      description: row.description,
      eyebrow: row.eyebrow,
      id: String(row.id),
      name: row.name,
      parentId: row.parent_id === null ? null : String(row.parent_id),
      slug: row.slug,
    }));
  }

  // Product details, category pages and navigation all read the taxonomy. Cached
  // here, a product page does not re-read it on every cache miss.
  const loadCategoryRows = unstable_cache(
    fetchCategoryRows,
    ["public-catalog", "category-rows"],
    { revalidate: 3_600, tags: [PUBLIC_CATALOG_CACHE_TAG] },
  );

  async function getCategoryTree(): Promise<readonly CatalogCategoryNode[]> {
    return buildCategoryTree(await loadCategoryRows());
  }

  /** Every brand slug a listing names is resolved in one query, not one per filter. */
  async function resolveBrandIdBySlug(
    slugs: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (slugs.length === 0) return new Map();

    const data = unwrap(
      await client
        .from("brands")
        .select("id, slug")
        .in("slug", [...slugs]),
      "Could not resolve brand filters",
    );

    return new Map(
      (data ?? []).map((row): [string, number] => [row.slug, row.id]),
    );
  }

  /** Null when the collection does not exist; an empty list when it holds nothing. */
  async function resolveCollectionProductIds(
    slug: string,
  ): Promise<readonly number[] | null> {
    const collection = unwrap(
      await client
        .from("collections")
        .select("id")
        .eq("slug", slug)
        .maybeSingle(),
      "Could not resolve collection",
    );

    if (!collection) return null;

    const assignments = unwrap(
      await client
        .from("collection_products")
        .select("product_id")
        .eq("collection_id", collection.id)
        .order("sort_order", { ascending: true }),
      "Could not resolve collection products",
    );

    return (assignments ?? []).map((row) => row.product_id);
  }

  async function resolveScope(
    request: CatalogListRequest,
  ): Promise<ResolvedScope> {
    const { filters } = request;

    const scope: ResolvedScope = {
      availability: filters.availability,
      brandId: null,
      brandIds: null,
      categoryIds: request.categoryIds?.length
        ? request.categoryIds.map((id) => Number(id))
        : null,
      featuredOnly: request.featuredOnly === true,
      impossible: false,
      productIds: null,
      searchTerm: filters.query ? sanitizeSearchTerm(filters.query) : "",
    };

    // The brand and collection lookups do not depend on each other, so they run
    // together rather than one after another.
    const brandSlugs = [
      ...new Set([request.brandSlug, ...filters.brandSlugs]),
    ].filter((slug): slug is string => Boolean(slug));

    const [brandIdBySlug, collectionProductIds] = await Promise.all([
      resolveBrandIdBySlug(brandSlugs),
      request.collectionSlug
        ? resolveCollectionProductIds(request.collectionSlug)
        : Promise.resolve(undefined),
    ]);

    if (request.brandSlug) {
      const brandId = brandIdBySlug.get(request.brandSlug);

      if (brandId === undefined) return { ...scope, impossible: true };

      scope.brandId = brandId;
    }

    if (request.collectionSlug) {
      if (!collectionProductIds?.length) return { ...scope, impossible: true };

      scope.productIds = collectionProductIds;
    }

    if (filters.brandSlugs.length > 0) {
      const brandIds = filters.brandSlugs.flatMap((slug) => {
        const brandId = brandIdBySlug.get(slug);

        return brandId === undefined ? [] : [brandId];
      });

      if (brandIds.length === 0) return { ...scope, impossible: true };

      scope.brandIds = brandIds;
    }

    return scope;
  }

  /**
   * One read of the facet rows under the constraints both facets share. The brand
   * and availability selections are applied afterwards by deriveCatalogFacets, so
   * the same rows answer both facets instead of each facet querying the table.
   */
  async function loadFacetRows(
    scope: ResolvedScope,
  ): Promise<readonly FacetSourceRow[]> {
    if (scope.impossible) return [];

    let query = client
      .from("products")
      .select(FACET_SELECT)
      .eq("status", "published")
      .is("archived_at", null);

    if (scope.categoryIds)
      query = query.in("category_id", [...scope.categoryIds]);
    if (scope.featuredOnly) query = query.eq("featured", true);
    if (scope.brandId !== null) query = query.eq("brand_id", scope.brandId);
    if (scope.productIds) query = query.in("id", [...scope.productIds]);
    if (scope.searchTerm) query = query.or(searchFilter(scope.searchTerm));

    const data = unwrap(await query, "Could not load catalog facets");

    return (data ?? []).map((row) => ({
      availability: toAvailability(row.availability),
      brandId: row.brand_id,
      brandName: row.brands?.name ?? null,
      brandSlug: row.brands?.slug ?? null,
    }));
  }

  async function loadBrands(
    featuredOnly: boolean,
  ): Promise<readonly CatalogBrand[]> {
    let query = client
      .from("brands")
      .select("id, name, slug, description, logo_path")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (featuredOnly) query = query.eq("featured", true);

    const data = unwrap(
      await query.limit(featuredOnly ? 9 : 200),
      "Could not load brands",
    );

    return (data ?? []).map((row) => ({
      // A brand's category mix is derived from its products, so no label is
      // invented here; the tile shows its own name rather than a guess.
      categoryLabel: "",
      demo: false,
      description: row.description,
      href: brandHref(row.slug),
      id: String(row.id),
      logoPath: row.logo_path,
      name: row.name,
      slug: row.slug,
    }));
  }

  return {
    async getAllProductSlugs() {
      const data = unwrap(
        await client
          .from("products")
          .select("slug")
          .eq("status", "published")
          .is("archived_at", null)
          .order("published_at", { ascending: false, nullsFirst: false }),
        "Could not load product slugs",
      );

      return (data ?? []).map((row) => row.slug);
    },

    async getBrandBySlug(slug) {
      const data = unwrap(
        await client
          .from("brands")
          .select("id, name, slug, description, logo_path")
          .eq("slug", slug)
          .maybeSingle(),
        "Could not load brand",
      );

      if (!data) return null;

      return {
        categoryLabel: "",
        demo: false,
        description: data.description,
        href: brandHref(data.slug),
        id: String(data.id),
        logoPath: data.logo_path,
        name: data.name,
        slug: data.slug,
      };
    },

    getBrands: () => loadBrands(false),

    async getCategories(): Promise<readonly CatalogCategory[]> {
      return flattenCategories(await getCategoryTree());
    },

    async getCategoryByPath(segments) {
      return findCategoryByPath(await getCategoryTree(), segments);
    },

    getCategoryTree,

    async getCollectionBySlug(slug) {
      const data = unwrap(
        await client
          .from("collections")
          .select("id, name, slug, eyebrow, description")
          .eq("slug", slug)
          .maybeSingle(),
        "Could not load collection",
      );

      if (!data) return null;

      return {
        demo: false,
        description: data.description,
        eyebrow: data.eyebrow,
        href: collectionHref(data.slug),
        id: String(data.id),
        name: data.name,
        slug: data.slug,
      };
    },

    async getCollections() {
      const data = unwrap(
        await client
          .from("collections")
          .select("id, name, slug, eyebrow, description")
          .order("featured", { ascending: false })
          .order("name", { ascending: true }),
        "Could not load collections",
      );

      return (data ?? []).map((row): CatalogCollection => ({
        demo: false,
        description: row.description,
        eyebrow: row.eyebrow,
        href: collectionHref(row.slug),
        id: String(row.id),
        name: row.name,
        slug: row.slug,
      }));
    },

    getFeaturedBrands: () => loadBrands(true),

    async getFeaturedProducts() {
      const data = unwrap(
        await client
          .from("products")
          .select(PRODUCT_SUMMARY_SELECT)
          .eq("status", "published")
          .is("archived_at", null)
          .eq("featured", true)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(8),
        "Could not load featured products",
      );

      return (data ?? []).map(mapProductSummary);
    },

    async getBrandPreviewProducts() {
      const data = unwrap(
        await client
          .from("products")
          .select(PRODUCT_SUMMARY_SELECT)
          .eq("status", "published")
          .is("archived_at", null)
          .order("featured", { ascending: false })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(BRAND_PREVIEW_PRODUCT_LIMIT),
        "Could not load brand previews",
      );

      return (data ?? []).map(mapProductSummary);
    },

    async getPageBySlug(slug) {
      const data = unwrap(
        await client
          .from("pages")
          .select(PAGE_SELECT)
          .eq("slug", slug)
          .maybeSingle(),
        "Could not load page",
      );

      return data ? mapPage(data) : null;
    },

    async getPages(kind) {
      const data = unwrap(
        await client
          .from("pages")
          .select(PAGE_SELECT)
          .eq("kind", kind)
          .order("title", { ascending: true }),
        "Could not load pages",
      );

      return (data ?? []).map(mapPage);
    },

    async getProductBySlug(slug) {
      const row = unwrap(
        await client
          .from("products")
          .select(PRODUCT_DETAIL_SELECT)
          .eq("slug", slug)
          .eq("status", "published")
          .is("archived_at", null)
          .maybeSingle(),
        "Could not load product",
      );

      if (!row) return null;

      return mapProductDetail(row, await getCategoryTree());
    },

    async getProductDetailsBySlugs(slugs) {
      if (slugs.length === 0) return [];

      const [result, categoryTree] = await Promise.all([
        client
          .from("products")
          .select(PRODUCT_DETAIL_SELECT)
          .in("slug", [...slugs])
          .eq("status", "published")
          .is("archived_at", null),
        getCategoryTree(),
      ]);

      const rows = unwrap(result, "Could not load shortlisted products");
      const bySlug = new Map(
        (rows ?? []).map((row): [string, ProductDetail] => [
          row.slug,
          mapProductDetail(row, categoryTree),
        ]),
      );

      // The caller's order is the visitor's own selection order, which must survive.
      return slugs.flatMap((slug) => {
        const detail = bySlug.get(slug);

        return detail ? [detail] : [];
      });
    },

    async getProductsBySlugs(slugs) {
      if (slugs.length === 0) return [];

      const data = unwrap(
        await client
          .from("products")
          .select(PRODUCT_SUMMARY_SELECT)
          .in("slug", [...slugs])
          .eq("status", "published")
          .is("archived_at", null),
        "Could not load shortlisted products",
      );

      const bySlug = new Map(
        (data ?? [])
          .map(mapProductSummary)
          .map((product) => [product.slug, product]),
      );

      // The caller's order is the visitor's own shortlist order, which must
      // survive the round trip even though PostgREST returns its own ordering.
      return slugs.flatMap((slug) => {
        const product = bySlug.get(slug);

        return product ? [product] : [];
      });
    },

    async listProducts(request) {
      const pageSize = request.pageSize ?? CATALOG_PAGE_SIZE;
      const { filters } = request;
      const scope = await resolveScope(request);

      if (scope.impossible) {
        return {
          facets: { availability: [], brands: [] },
          page: filters.page,
          pageCount: 1,
          pageSize,
          products: [],
          total: 0,
        };
      }

      let query = client
        .from("products")
        .select(PRODUCT_SUMMARY_SELECT, { count: "exact" })
        .eq("status", "published")
        .is("archived_at", null);

      if (scope.categoryIds) {
        query = query.in("category_id", [...scope.categoryIds]);
      }
      if (scope.featuredOnly) query = query.eq("featured", true);
      if (scope.brandId !== null) query = query.eq("brand_id", scope.brandId);
      if (scope.productIds) query = query.in("id", [...scope.productIds]);
      if (scope.brandIds) query = query.in("brand_id", [...scope.brandIds]);
      if (scope.availability.length > 0) {
        query = query.in("availability", [...scope.availability]);
      }
      if (scope.searchTerm) query = query.or(searchFilter(scope.searchTerm));

      switch (filters.sort) {
        case "newest":
          query = query.order("published_at", {
            ascending: false,
            nullsFirst: false,
          });
          break;
        case "price_asc":
          query = query
            .order("price", { ascending: true, nullsFirst: false })
            .order("published_at", { ascending: false, nullsFirst: false });
          break;
        case "price_desc":
          query = query
            .order("price", { ascending: false, nullsFirst: false })
            .order("published_at", { ascending: false, nullsFirst: false });
          break;
        default:
          query = query
            .order("featured", { ascending: false })
            .order("published_at", { ascending: false, nullsFirst: false });
      }

      const from = (filters.page - 1) * pageSize;

      // The listing and its facets read the same scope, so they run together rather
      // than the facets waiting for the listing to finish.
      const [result, facetRows] = await Promise.all([
        query
          .order("id", { ascending: false })
          .range(from, from + pageSize - 1),
        loadFacetRows(scope),
      ]);

      const data = unwrap(result, "Could not load catalog products");
      const total = result.count ?? 0;

      return {
        facets: deriveCatalogFacets(facetRows, {
          availability: scope.availability,
          brandIds: scope.brandIds,
        }),
        page: filters.page,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
        pageSize,
        products: (data ?? []).map(mapProductSummary),
        total,
      };
    },
  };
}

function mapPage(row: {
  body_markdown: string;
  excerpt: string | null;
  kind: string;
  slug: string;
  title: string;
}): EditorialPage {
  return {
    bodyMarkdown: row.body_markdown,
    excerpt: row.excerpt,
    href:
      row.kind === "policy" ? `/policies/${row.slug}` : `/guides/${row.slug}`,
    kind: row.kind,
    slug: row.slug,
    title: row.title,
  };
}

export function tryCreateSupabaseCatalogRepository(): CatalogRepository | null {
  const client = getPublicCatalogClient();

  return client ? createSupabaseCatalogRepository(client) : null;
}

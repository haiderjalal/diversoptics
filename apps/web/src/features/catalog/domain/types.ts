export type PriceMode = "fixed" | "from" | "on_inquiry" | "hidden";

export type Availability =
  "in_store" | "available_to_order" | "out_of_stock" | "ask";

export type PublishStatus = "draft" | "published" | "archived";

export type StaffRole = "owner" | "editor" | "viewer";

export type AttributeValueType =
  "text" | "number" | "boolean" | "option" | "multi_option";

/**
 * Every public catalog record carries `demo` so a fixture can never be presented
 * as verified inventory. AGENTS.md requires unconfirmed values to be labelled,
 * and the flag is what the disclosure components read.
 */
export type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  description: string;
  href: string;
  demo: boolean;
};

export type CatalogCategoryNode = CatalogCategory & {
  parentId: string | null;
  children: readonly CatalogCategoryNode[];
};

export type CatalogBrand = {
  id: string;
  slug: string;
  name: string;
  categoryLabel: string;
  description: string | null;
  logoPath: string | null;
  href: string;
  demo: boolean;
};

export type CatalogImage = {
  id: string;
  path: string;
  altText: string;
  width: number;
  height: number;
  focalX: number;
  focalY: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  modelNumber: string;
  eyebrow: string;
  shortDescription: string | null;
  price: number | null;
  priceMode: PriceMode;
  currency: string;
  availability: Availability;
  status: PublishStatus;
  featured: boolean;
  brandName: string | null;
  brandSlug: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  primaryImage: CatalogImage | null;
  href: string;
  demo: boolean;
};

export type ProductVariantOption = {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  priceMode: PriceMode | null;
  availability: Availability;
};

export type ProductAttributeValue = {
  key: string;
  name: string;
  valueType: AttributeValueType;
  /** Presentation-ready text; the raw column shape never reaches a component. */
  displayValue: string;
};

export type ProductDetail = ProductSummary & {
  description: string | null;
  images: readonly CatalogImage[];
  variants: readonly ProductVariantOption[];
  attributes: readonly ProductAttributeValue[];
  categoryHref: string | null;
  brandHref: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type CatalogCollection = {
  id: string;
  slug: string;
  name: string;
  eyebrow: string | null;
  description: string | null;
  href: string;
  demo: boolean;
};

export type EditorialPage = {
  slug: string;
  kind: string;
  title: string;
  excerpt: string | null;
  bodyMarkdown: string;
  href: string;
};

/**
 * Public business facts come from the CMS settings singleton. Nothing in this
 * shape may be hard-coded into a component; AGENTS.md treats every unconfirmed
 * value as a labelled placeholder instead.
 */
export type StoreSettings = {
  locationLabel: string;
  fullAddress: string | null;
  whatsappNumber: string;
  phoneNumber: string | null;
  publicEmail: string | null;
  businessHours: readonly StoreOpeningHours[];
  deliveryAvailable: boolean;
};

export type StoreOpeningHours = {
  day: string;
  opens: string | null;
  closes: string | null;
  closed: boolean;
};

export type CatalogSort = "featured" | "newest" | "price_asc" | "price_desc";

export type CatalogFilterState = {
  query: string | null;
  brandSlugs: readonly string[];
  availability: readonly Availability[];
  sort: CatalogSort;
  page: number;
};

export type CatalogFacet = {
  slug: string;
  label: string;
  count: number;
};

export type CatalogFacets = {
  brands: readonly CatalogFacet[];
  availability: readonly CatalogFacet[];
};

export type CatalogPage = {
  products: readonly ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: CatalogFacets;
};

export type ShortlistEntry = {
  slug: string;
  variantSku: string | null;
};

/**
 * Wire shape returned by the shortlist endpoint. The shortlist lives in browser
 * storage, so its page resolves slugs through an API call rather than on the
 * server, and this is the contract both sides share.
 */
export type ShortlistApiProduct = {
  slug: string;
  name: string;
  sku: string;
  brandName: string | null;
  eyebrow: string;
  href: string;
  imagePath: string | null;
  priceLabel: string | null;
  availabilityLabel: string;
};

export type InquirySnapshotItem = {
  slug: string;
  name: string;
  sku: string;
  brand: string | null;
  variantSku: string | null;
  priceLabel: string | null;
  availabilityLabel: string;
  url: string;
};

export interface CatalogRepository {
  getCategories(): Promise<readonly CatalogCategory[]>;
  getCategoryTree(): Promise<readonly CatalogCategoryNode[]>;
  getCategoryByPath(
    segments: readonly string[],
  ): Promise<CatalogCategoryNode | null>;
  getFeaturedProducts(): Promise<readonly ProductSummary[]>;
  /**
   * Published products for choosing one photograph per brand. Featured products
   * come first, and the read is capped at BRAND_PREVIEW_PRODUCT_LIMIT.
   */
  getBrandPreviewProducts(): Promise<readonly ProductSummary[]>;
  getFeaturedBrands(): Promise<readonly CatalogBrand[]>;
  getBrands(): Promise<readonly CatalogBrand[]>;
  getBrandBySlug(slug: string): Promise<CatalogBrand | null>;
  getCollections(): Promise<readonly CatalogCollection[]>;
  getCollectionBySlug(slug: string): Promise<CatalogCollection | null>;
  getProductBySlug(slug: string): Promise<ProductDetail | null>;
  getProductsBySlugs(
    slugs: readonly string[],
  ): Promise<readonly ProductSummary[]>;
  getAllProductSlugs(): Promise<readonly string[]>;
  listProducts(request: CatalogListRequest): Promise<CatalogPage>;
  getPages(kind: string): Promise<readonly EditorialPage[]>;
  getPageBySlug(slug: string): Promise<EditorialPage | null>;
}

export type CatalogListRequest = {
  categoryIds?: readonly string[];
  brandSlug?: string;
  collectionSlug?: string;
  featuredOnly?: boolean;
  filters: CatalogFilterState;
  pageSize?: number;
};

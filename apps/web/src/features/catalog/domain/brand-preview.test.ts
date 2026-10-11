import { describe, expect, it } from "vitest";

import { brandPreviewImage } from "./brand-preview";
import type { CatalogImage, ProductSummary } from "./types";

const photo: CatalogImage = {
  altText: "Front view",
  focalX: 0.5,
  focalY: 0.5,
  height: 800,
  id: "image-1",
  path: "products/front.webp",
  width: 800,
};

function productFor(
  brandSlug: string,
  primaryImage: CatalogImage | null,
): ProductSummary {
  return {
    availability: "in_store",
    brandName: brandSlug,
    brandSlug,
    categoryName: "Eyewear",
    categorySlug: "eyewear",
    currency: "PKR",
    demo: true,
    eyebrow: "Eyewear",
    featured: true,
    href: `/products/${brandSlug}-frame`,
    id: `${brandSlug}-frame`,
    modelNumber: "FR-1",
    name: "Frame",
    price: 1000,
    priceMode: "fixed",
    primaryImage,
    shortDescription: null,
    sku: "SKU-1",
    slug: `${brandSlug}-frame`,
    status: "published",
  };
}

describe("brandPreviewImage", () => {
  it("returns the first photograph of a product from the same brand", () => {
    const products = [
      productFor("chopard", null),
      productFor("chopard", photo),
    ];

    expect(brandPreviewImage("chopard", products)).toBe(photo);
  });

  it("never borrows a photograph from another brand", () => {
    const products = [productFor("chopard", photo)];

    expect(brandPreviewImage("louis-vuitton", products)).toBeNull();
  });

  it("returns null when no matching product has an image", () => {
    expect(
      brandPreviewImage("chopard", [productFor("chopard", null)]),
    ).toBeNull();
  });
});

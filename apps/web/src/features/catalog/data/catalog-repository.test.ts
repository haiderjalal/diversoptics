import { describe, expect, it } from "vitest";

import { resolveCatalogSource } from "../domain/catalog-source";
import { DEFAULT_CATALOG_FILTERS } from "../domain/filters";
import {
  createFixtureCatalogRepository,
  emptyCatalogRepository,
} from "./fixture-catalog";

describe("catalog source resolution", () => {
  it("never serves fictional inventory from production", () => {
    expect(resolveCatalogSource("production", true)).toBe("supabase");
    expect(resolveCatalogSource("production", false)).toBe("empty");
  });

  it("ignores a fixture request in production", () => {
    // A misconfigured environment variable must not be able to publish invented
    // products on the real public destination.
    expect(resolveCatalogSource("production", true, "fixtures")).toBe(
      "supabase",
    );
    expect(resolveCatalogSource("production", false, "fixtures")).toBe("empty");
  });

  it("falls back to fixtures only outside production", () => {
    expect(resolveCatalogSource("preview", false)).toBe("fixtures");
    expect(resolveCatalogSource("development", false)).toBe("fixtures");
  });

  it("prefers a connected project but lets a developer pin fixtures", () => {
    expect(resolveCatalogSource("development", true)).toBe("supabase");
    expect(resolveCatalogSource("development", true, "fixtures")).toBe(
      "fixtures",
    );
  });
});

describe("fixture catalog", () => {
  it("labels every fixture product as demo data", async () => {
    const products = await createFixtureCatalogRepository().listProducts({
      filters: DEFAULT_CATALOG_FILTERS,
    });

    expect(products.total).toBeGreaterThan(0);
    expect(products.products.every((product) => product.demo)).toBe(true);
    expect(
      products.products.every((product) => product.sku.startsWith("DEMO-")),
    ).toBe(true);
  });

  it("scopes a category listing to its descendants", async () => {
    const repository = createFixtureCatalogRepository();
    const eyewear = await repository.getCategoryByPath(["eyewear"]);
    const sunglasses = await repository.getCategoryByPath([
      "eyewear",
      "sunglasses",
    ]);

    expect(eyewear?.name).toBe("Eyewear");
    expect(sunglasses?.href).toBe("/eyewear/sunglasses");
    // Browsing the parent must include products filed on its children.
    expect(eyewear?.children.length).toBeGreaterThan(1);
  });

  it("offers only published products for brand photographs", async () => {
    const products =
      await createFixtureCatalogRepository().getBrandPreviewProducts();

    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.status === "published")).toBe(
      true,
    );
  });

  it("returns full detail for each requested product, in the caller's order", async () => {
    const repository = createFixtureCatalogRepository();
    const slugs = ["demo-watch-01", "demo-frame-01", "not-a-product"];
    const details = await repository.getProductDetailsBySlugs(slugs);

    expect(details.map((product) => product.slug)).toEqual([
      "demo-watch-01",
      "demo-frame-01",
    ]);
    expect(details[0]?.variants).toBeDefined();
  });

  it("preserves shortlist order when resolving products", async () => {
    const repository = createFixtureCatalogRepository();
    const slugs = ["demo-watch-01", "demo-frame-01"];
    const products = await repository.getProductsBySlugs(slugs);

    expect(products.map((product) => product.slug)).toEqual(slugs);
  });

  it("returns an empty page rather than the whole catalog for an unknown brand", async () => {
    const page = await createFixtureCatalogRepository().listProducts({
      brandSlug: "not-a-brand",
      filters: DEFAULT_CATALOG_FILTERS,
    });

    expect(page.products).toEqual([]);
    expect(page.total).toBe(0);
  });
});

describe("empty catalog", () => {
  it("answers every read without inventing content", async () => {
    await expect(emptyCatalogRepository.getFeaturedProducts()).resolves.toEqual(
      [],
    );
    await expect(
      emptyCatalogRepository.getBrandPreviewProducts(),
    ).resolves.toEqual([]);
    await expect(
      emptyCatalogRepository.getProductDetailsBySlugs(["demo-frame-01"]),
    ).resolves.toEqual([]);
    await expect(emptyCatalogRepository.getCategories()).resolves.toEqual([]);
    await expect(
      emptyCatalogRepository.getProductBySlug("demo-frame-01"),
    ).resolves.toBeNull();
  });
});

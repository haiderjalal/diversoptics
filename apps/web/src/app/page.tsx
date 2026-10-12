import type { Metadata } from "next";

import { HomePage } from "@/components/home/home-page";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteShell } from "@/components/site/site-shell";
import {
  createCatalogRepository,
  isDemoCatalog,
} from "@/features/catalog/data/catalog-repository";
import { getStoreSettings } from "@/features/catalog/data/store-settings";
import { buildLocalBusinessSchema } from "@/features/catalog/domain/structured-data";
import { getSiteUrl } from "@/lib/config/site";

/**
 * This page is prerendered, and its content comes from the CMS. Without a
 * revalidation window it would be baked at deploy time and never reflect a
 * product the owner publishes later, until someone redeployed. Sixty seconds
 * keeps CMS edits visible quickly at negligible cost for this traffic level.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "Browse eyewear, watches, pens and cufflinks from Diverso Optics in F-11 Markaz, Islamabad, then ask on WhatsApp before you visit.",
  title: "Eyewear, Watches & Pens in F-11 Islamabad",
};

export default async function Page() {
  const repository = createCatalogRepository();

  const [brands, tree, products, brandPhotoProducts, settings] =
    await Promise.all([
      repository.getFeaturedBrands(),
      repository.getCategoryTree(),
      repository.getFeaturedProducts(),
      repository.getBrandPreviewProducts(),
      getStoreSettings(),
    ]);

  return (
    <SiteShell>
      {settings ? (
        <JsonLd
          data={buildLocalBusinessSchema({ settings, siteUrl: getSiteUrl() })}
        />
      ) : null}
      <HomePage
        brands={brands}
        // Only top-level categories act as the home page's entry points.
        categories={tree}
        brandPhotoProducts={brandPhotoProducts}
        demo={isDemoCatalog()}
        products={products}
      />
    </SiteShell>
  );
}

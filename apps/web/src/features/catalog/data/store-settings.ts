import "server-only";

import { unstable_cache } from "next/cache";

import { getPublicCatalogClient } from "@/lib/supabase/public";
import { resolveDeploymentEnvironment } from "@/lib/config/site";

import { resolveCatalogSource } from "../domain/catalog-source";
import { parseBusinessHours } from "../domain/store-hours";
import type { StoreSettings } from "../domain/types";
import { demoStoreSettings } from "./demo-fixtures";
import { PUBLIC_CATALOG_CACHE_TAG } from "./public-catalog-cache";

/**
 * The WhatsApp destination, address and hours are business facts owned by the CMS
 * singleton. Nothing here is defaulted to a plausible value: an unset column stays
 * null so the interface can say the fact is not confirmed yet.
 */
async function loadStoreSettings(): Promise<StoreSettings | null> {
  const client = getPublicCatalogClient();
  const source = resolveCatalogSource(
    resolveDeploymentEnvironment(),
    client !== null,
  );

  if (source === "fixtures") return demoStoreSettings;
  if (!client) return null;

  const { data, error } = await client
    .from("site_settings")
    .select(
      "location_label, full_address, whatsapp_number, phone_number, public_email, business_hours, delivery_available",
    )
    .eq("id", true)
    .maybeSingle();

  /**
   * Settings are supplementary: every page that reads them already renders an
   * honest "not confirmed" state, and the WhatsApp destination falls back to the
   * environment-safe configured number. So a failure here degrades instead of
   * throwing — losing the shop address must not take down the whole storefront.
   *
   * This also covers the window before the Phase 03 read grant is applied, when
   * anon reads are still denied on this table.
   */
  if (error) {
    console.error("Could not load store settings", error.message);

    return null;
  }

  if (!data) return null;

  return {
    businessHours: parseBusinessHours(data.business_hours),
    deliveryAvailable: data.delivery_available,
    fullAddress: data.full_address,
    locationLabel: data.location_label,
    phoneNumber: data.phone_number,
    publicEmail: data.public_email,
    whatsappNumber: data.whatsapp_number,
  };
}

export const getStoreSettings = unstable_cache(
  loadStoreSettings,
  ["public-catalog", "store-settings"],
  { revalidate: 3_600, tags: [PUBLIC_CATALOG_CACHE_TAG] },
);

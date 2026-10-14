import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createCatalogRepository } from "@/features/catalog/data/catalog-repository";
import {
  readCampaign,
  recordInquiryEvent,
} from "@/features/catalog/data/inquiry-events";
import { getStoreSettings } from "@/features/catalog/data/store-settings";
import {
  formatAvailabilityLabel,
  formatPriceLabel,
  formatVariantPriceLabel,
} from "@/features/catalog/domain/price";
import {
  isProductSlug,
  SHORTLIST_LIMIT,
} from "@/features/catalog/domain/shortlist";
import type {
  InquirySnapshotItem,
  ProductDetail,
} from "@/features/catalog/domain/types";
import {
  buildShortlistMessage,
  buildSingleProductMessage,
  buildWhatsAppHref,
  resolveWhatsAppDestination,
} from "@/features/catalog/domain/whatsapp";
import { absoluteUrl, resolveDeploymentEnvironment } from "@/lib/config/site";

/**
 * A random, opaque token used only to tell one visitor's inquiries apart so a
 * double tap is not counted twice. It is hashed before storage, carries no
 * personal data, and is never read by anything except this route.
 */
const SESSION_COOKIE = "diverso_inquiry_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const MAX_NOTE_LENGTH = 200;
const MAX_VARIANT_SKU_LENGTH = 64;

type Selection = { slug: string; variantSku: string | null };

/**
 * Parses `slug` or `slug:VARIANT-SKU` pairs. Anything that is not a usable
 * product reference is dropped rather than passed on, so a hand-edited link
 * cannot inject text into the WhatsApp message or the stored event.
 */
function parseSelections(raw: string | null): readonly Selection[] {
  if (!raw) return [];

  const selections: Selection[] = [];
  const seen = new Set<string>();

  for (const entry of raw.split(",")) {
    const [slugPart, variantPart] = entry.split(":");
    const slug = slugPart?.trim().toLowerCase() ?? "";

    if (!isProductSlug(slug) || seen.has(slug)) continue;

    const variantSku = variantPart?.trim()
      ? variantPart.trim().slice(0, MAX_VARIANT_SKU_LENGTH)
      : null;

    seen.add(slug);
    selections.push({ slug, variantSku });

    if (selections.length === SHORTLIST_LIMIT) break;
  }

  return selections;
}

/**
 * The variant is verified against the product's own published variants. A SKU
 * that does not belong to the product is discarded, so the message can never
 * quote an option the store does not have.
 */
function toSnapshotItem(
  product: ProductDetail,
  requestedVariantSku: string | null,
): InquirySnapshotItem {
  const variant =
    product.variants.find((option) => option.sku === requestedVariantSku) ??
    null;

  return {
    availabilityLabel: formatAvailabilityLabel(
      variant?.availability ?? product.availability,
    ),
    brand: product.brandName,
    name: product.name,
    priceLabel: variant
      ? formatVariantPriceLabel(product, variant)
      : formatPriceLabel(product),
    sku: variant?.sku ?? product.sku,
    slug: product.slug,
    url: absoluteUrl(product.href),
    variantSku: variant?.sku ?? null,
  };
}

/**
 * docs/04: the click records a minimal first-party inquiry event and then
 * redirects straight to WhatsApp. The redirect is what the visitor asked for, so
 * a logging failure never blocks it — the handoff just carries no reference.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const repository = createCatalogRepository();

  const productSlug = url.searchParams.get("product");
  const shortlistParam = url.searchParams.get("shortlist");

  const selections = productSlug
    ? parseSelections(
        `${productSlug}${
          url.searchParams.get("variant")
            ? `:${url.searchParams.get("variant")}`
            : ""
        }`,
      )
    : parseSelections(shortlistParam);

  if (selections.length === 0) {
    return NextResponse.redirect(new URL("/shortlist", url), 303);
  }

  // Variants decide whether a SKU in the link is real, so the detail read is the
  // only read needed: one query covers every product in the selection.
  const details = await repository.getProductDetailsBySlugs(
    selections.map((selection) => selection.slug),
  );

  if (details.length === 0) {
    // Every requested product is unpublished or gone; send the visitor somewhere
    // useful instead of opening a chat about nothing.
    return NextResponse.redirect(new URL("/search", url), 303);
  }

  const items = details.map((product) => {
    const requested = selections.find(
      (selection) => selection.slug === product.slug,
    );

    return toSnapshotItem(product, requested?.variantSku ?? null);
  });

  const settings = await getStoreSettings();
  const destination = resolveWhatsAppDestination(
    settings?.whatsappNumber,
  ).internationalDigits;

  const singleProduct = Boolean(productSlug) && items.length === 1;

  const existingSession = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)?.[1];

  const sessionToken = existingSession ?? randomUUID();

  const reference = await recordInquiryEvent({
    campaign: readCampaign(url.searchParams),
    entryPath: url.pathname,
    eventType: singleProduct ? "single_product" : "shortlist",
    items,
    sessionToken,
  });

  const firstItem = items[0];

  const message =
    singleProduct && firstItem
      ? buildSingleProductMessage(firstItem, reference)
      : buildShortlistMessage(
          items,
          // The note is visitor-authored free text. It reaches WhatsApp, which is
          // where the conversation belongs, but is never sent to analytics.
          (url.searchParams.get("note") ?? "")
            .trim()
            .slice(0, MAX_NOTE_LENGTH) || null,
          reference,
        );

  const response = NextResponse.redirect(
    buildWhatsAppHref(destination, message),
    303,
  );

  if (!existingSession) {
    response.cookies.set({
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_SECONDS,
      name: SESSION_COOKIE,
      path: "/",
      sameSite: "lax",
      secure: resolveDeploymentEnvironment() !== "development",
      value: sessionToken,
    });
  }

  return response;
}

import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getPublicCatalogClient } from "@/lib/supabase/public";

import type { InquirySnapshotItem } from "../domain/types";

export type InquiryEventType = "single_product" | "shortlist";

export type RecordInquiryInput = {
  campaign: Readonly<Record<string, string>>;
  entryPath: string | null;
  eventType: InquiryEventType;
  items: readonly InquirySnapshotItem[];
  sessionToken: string | null;
};

/**
 * Raw tokens are hashed here rather than in Postgres, so no reversible visitor
 * identifier ever leaves the application. The database only accepts hex digests
 * and verifies the format, which also stops a raw token being passed by mistake.
 */
function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newInquirySessionToken(): string {
  return randomUUID();
}

/**
 * The key is stable for one visitor's one selection, so a double tap, a retried
 * navigation or a prefetch reuses the first reference instead of logging a second
 * inquiry. It deliberately excludes any timestamp for that reason.
 */
export function buildIdempotencyKey(input: RecordInquiryInput): string {
  const selection = input.items
    .map((item) => `${item.slug}:${item.variantSku ?? ""}`)
    .join("|");

  return sha256Hex(
    [input.eventType, input.sessionToken ?? "anonymous", selection].join("::"),
  );
}

/**
 * Only the fields the database allowlist keeps are sent. Nothing derived from a
 * free-text field is included, so prescription details or contact data cannot
 * reach analytics even by accident.
 */
function toSnapshot(items: readonly InquirySnapshotItem[]) {
  return items.map((item) => ({
    availability: item.availabilityLabel,
    brand: item.brand ?? "",
    name: item.name,
    sku: item.sku,
    slug: item.slug,
    variant_sku: item.variantSku ?? "",
  }));
}

/**
 * docs/04 requires the inquiry event to be written before the WhatsApp redirect,
 * but the redirect is the thing the visitor actually asked for. A logging failure
 * therefore returns no reference instead of blocking the handoff, and the caller
 * still redirects.
 */
export async function recordInquiryEvent(
  input: RecordInquiryInput,
): Promise<string | null> {
  if (input.items.length === 0) return null;

  const client = getPublicCatalogClient();

  if (!client) return null;

  const { data, error } = await client.rpc("record_inquiry_event", {
    p_anonymous_session_hash: input.sessionToken
      ? sha256Hex(input.sessionToken)
      : undefined,
    p_campaign: input.campaign,
    p_catalog_snapshot: toSnapshot(input.items),
    p_entry_path: input.entryPath ?? undefined,
    p_event_type: input.eventType,
    p_idempotency_key_hash: buildIdempotencyKey(input),
  });

  if (error) {
    console.error("Could not record inquiry event", error.message);

    return null;
  }

  return typeof data === "string" ? data : null;
}

const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
] as const;

/**
 * Campaign attribution is limited to the same keys the database keeps, so an
 * arbitrary query parameter never becomes stored analytics.
 */
export function readCampaign(
  params: URLSearchParams,
): Readonly<Record<string, string>> {
  const campaign: Record<string, string> = {};

  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key)?.trim();

    if (value) campaign[key] = value.slice(0, 120);
  }

  return campaign;
}

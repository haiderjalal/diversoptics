import { resolveDeploymentEnvironment } from "@/lib/config/site";

import {
  resolveCatalogSource,
  type CatalogSource,
} from "../domain/catalog-source";
import type { CatalogRepository } from "../domain/types";
import {
  createFixtureCatalogRepository,
  emptyCatalogRepository,
} from "./fixture-catalog";
import { cachePublicCatalogRepository } from "./public-catalog-cache";
import { tryCreateSupabaseCatalogRepository } from "./supabase-catalog";

type ActiveCatalog = {
  demo: boolean;
  repository: CatalogRepository;
};

let activeCatalog: ActiveCatalog | undefined;

function repositoryFor(
  source: CatalogSource,
  supabase: CatalogRepository | null,
): CatalogRepository {
  switch (source) {
    case "supabase":
      // supabase is non-null whenever the policy resolves to this source.
      return supabase
        ? cachePublicCatalogRepository(supabase)
        : emptyCatalogRepository;
    case "fixtures":
      return createFixtureCatalogRepository();
    default:
      return emptyCatalogRepository;
  }
}

/**
 * Resolved once per process. Resolving it on every call rebuilt the Supabase
 * client, the cache wrappers and, for fixtures, the whole in-memory catalog, and
 * a single page calls in several times. Environment is fixed per deployment, so
 * the first resolution is the answer for the life of the process.
 */
function resolveActiveCatalog(): ActiveCatalog {
  if (activeCatalog) return activeCatalog;

  const supabase = tryCreateSupabaseCatalogRepository();
  const source = resolveCatalogSource(
    resolveDeploymentEnvironment(),
    supabase !== null,
  );

  activeCatalog = {
    demo: source === "fixtures",
    repository: repositoryFor(source, supabase),
  };

  return activeCatalog;
}

export function createCatalogRepository(): CatalogRepository {
  return resolveActiveCatalog().repository;
}

/**
 * True when the active catalog is fictional. Public pages read this to render the
 * fixture disclosure AGENTS.md requires for unconfirmed content, so a preview can
 * never be mistaken for real inventory.
 */
export function isDemoCatalog(): boolean {
  return resolveActiveCatalog().demo;
}

export { createFixtureCatalogRepository, emptyCatalogRepository };

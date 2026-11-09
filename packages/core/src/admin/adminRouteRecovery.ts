export type PersistedAdminRoutes<T = unknown> = {
  routes: T[];
  url: string;
  moduleName?: string;
};

export type AdminRouteState = {
  [key: string]: unknown;
  routes?: unknown;
};

export function readPersistedAdminRoutes<T = unknown>(
  value: unknown,
): PersistedAdminRoutes<T> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record.routes) ||
    typeof record.url !== 'string' ||
    record.url.length === 0
  ) {
    return undefined;
  }
  const moduleName =
    typeof record.moduleName === 'string' ? record.moduleName : undefined;
  return {
    routes: record.routes as T[],
    url: record.url,
    moduleName,
  };
}

/**
 * Routes persisted by a previous core process. The last entry for a url wins:
 * a falsy index used to push a duplicate instead of replacing index 0.
 * Module health is not consulted. Already-running modules do not re-register
 * after core restarts, matching the router's recovery of client routes.
 */
export function adminRoutesFromState<T = unknown>(
  state: unknown,
): PersistedAdminRoutes<T>[] {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
  const routes = (state as AdminRouteState).routes;
  if (!Array.isArray(routes)) return [];
  const byUrl = new Map<string, PersistedAdminRoutes<T>>();
  for (const entry of routes) {
    const parsed = readPersistedAdminRoutes<T>(entry);
    if (!parsed) continue;
    byUrl.set(parsed.url, parsed);
  }
  return [...byUrl.values()];
}

export function adminRouteFromBusMessage<T = unknown>(
  message: string,
):
  | { ok: true; entry: PersistedAdminRoutes<T> | undefined }
  | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return { ok: true, entry: readPersistedAdminRoutes<T>(value) };
}

export function upsertAdminRoute<T>(
  state: AdminRouteState | null | undefined,
  entry: PersistedAdminRoutes<T>,
): AdminRouteState {
  const next: AdminRouteState = state && typeof state === 'object' ? { ...state } : {};
  const existing = Array.isArray(next.routes) ? [...next.routes] : [];
  const index = existing.findIndex(value => {
    return (
      !!value &&
      typeof value === 'object' &&
      (value as { url?: unknown }).url === entry.url
    );
  });
  const stored: PersistedAdminRoutes<T> = {
    routes: entry.routes,
    url: entry.url,
    moduleName: entry.moduleName,
  };
  if (index === -1) existing.push(stored);
  else existing[index] = stored;
  next.routes = existing;
  return next;
}

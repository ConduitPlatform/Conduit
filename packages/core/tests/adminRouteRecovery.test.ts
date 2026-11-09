import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adminRouteFromBusMessage,
  adminRoutesFromState,
  upsertAdminRoute,
  type PersistedAdminRoutes,
} from '../src/admin/adminRouteRecovery.ts';

type Route = { options: { action: string; path: string } };

const authenticationUrl = 'conduit-authentication-headless:5000';
const storageUrl = 'conduit-storage-headless:5000';

function entry(
  url: string,
  moduleName: string,
  paths: string[],
): PersistedAdminRoutes<Route> {
  return {
    url,
    moduleName,
    routes: paths.map(path => ({ options: { action: 'GET', path } })),
  };
}

describe('admin routes after a core restart', () => {
  it('restores routes for modules that stay running and do not re-register', () => {
    // The previous core stored routes when each module called registerAdminRoute.
    let state = upsertAdminRoute(
      undefined,
      entry(authenticationUrl, 'authentication', ['/authentication/users']),
    );
    state = upsertAdminRoute(state, entry(storageUrl, 'storage', ['/storage/files']));
    // Index 0 is the first url. A later update of that url must replace it.
    state = upsertAdminRoute(
      state,
      entry(authenticationUrl, 'authentication', [
        '/authentication/users',
        '/authentication/teams',
      ]),
    );
    assert.equal((state.routes as unknown[]).length, 2);

    // Core exited. Authentication and storage were already running, so they do
    // not call registerAdminRoute again. The new process only has Redis state.
    const restored = adminRoutesFromState<Route>(state);
    const byModule = new Map(restored.map(item => [item.moduleName, item]));
    assert.deepEqual([...byModule.keys()].sort(), ['authentication', 'storage']);
    assert.deepEqual(
      byModule.get('authentication')?.routes.map(route => route.options.path),
      ['/authentication/users', '/authentication/teams'],
    );
    assert.equal(byModule.get('storage')?.url, storageUrl);
    assert.equal(
      byModule
        .get('authentication')
        ?.routes.some(route => route.options.path === '/authentication/users'),
      true,
    );
  });

  it('keeps the latest copy when the same module url was persisted twice', () => {
    const restored = adminRoutesFromState<Route>({
      routes: [
        entry(authenticationUrl, 'authentication', ['/authentication/old']),
        entry(authenticationUrl, 'authentication', ['/authentication/users']),
      ],
    });
    assert.equal(restored.length, 1);
    assert.equal(restored[0].routes[0].options.path, '/authentication/users');
  });

  it('drops the old url when a module moves to a new one', () => {
    const oldUrl = 'conduit-authentication-old:5000';
    let state = upsertAdminRoute(
      undefined,
      entry(oldUrl, 'authentication', ['/authentication/users', '/authentication/gone']),
    );
    state = upsertAdminRoute(state, entry(storageUrl, 'storage', ['/storage/files']));
    state = upsertAdminRoute(
      state,
      entry(authenticationUrl, 'authentication', ['/authentication/users']),
    );
    const persisted = state.routes as PersistedAdminRoutes<Route>[];
    assert.equal(persisted.length, 2);
    assert.equal(
      persisted.some(item => item.url === oldUrl),
      false,
    );
    const restored = adminRoutesFromState<Route>(state);
    const auth = restored.filter(item => item.moduleName === 'authentication');
    assert.equal(auth.length, 1);
    assert.equal(auth[0].url, authenticationUrl);
  });

  it('keeps url-keyed behavior for entries without a moduleName', () => {
    let state = upsertAdminRoute(undefined, {
      url: 'a:1',
      routes: [],
    } as PersistedAdminRoutes<Route>);
    state = upsertAdminRoute(state, { url: 'b:1', routes: [] });
    assert.equal((state.routes as unknown[]).length, 2);
  });

  it('restores only the last url when state already holds two for a module', () => {
    const restored = adminRoutesFromState<Route>({
      routes: [
        entry('conduit-authentication-old:5000', 'authentication', ['/authentication/gone']),
        entry(storageUrl, 'storage', ['/storage/files']),
        entry(authenticationUrl, 'authentication', ['/authentication/users']),
      ],
    });
    assert.equal(restored.length, 2);
    const auth = restored.filter(item => item.moduleName === 'authentication');
    assert.equal(auth.length, 1);
    assert.equal(auth[0].url, authenticationUrl);
    assert.equal(auth[0].routes[0].options.path, '/authentication/users');
  });

  it('reads the payload published on the admin channel', () => {
    const published = JSON.stringify(
      entry(authenticationUrl, 'authentication', ['/authentication/users']),
    );
    const parsed = adminRouteFromBusMessage<Route>(published);
    assert.equal(parsed.ok, true);
    if (!parsed.ok || !parsed.entry) {
      assert.fail('expected a route entry');
    }
    assert.equal(parsed.entry.moduleName, 'authentication');
    assert.equal(parsed.entry.url, authenticationUrl);
    assert.equal(parsed.entry.routes[0].options.path, '/authentication/users');
  });

  it('drops a non-JSON admin bus message', () => {
    const parsed = adminRouteFromBusMessage('reconciling');
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, /reconciling/);
  });
});

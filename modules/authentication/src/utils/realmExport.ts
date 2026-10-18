/**
 * IO side of the realm GitOps export/import. The transforms live in
 * ./realmExport.logic.ts.
 */
import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import type { ImportResult } from '@conduitplatform/module-tools';

import { RealmSettings, Team } from '../models/index.js';
import {
  assertNoNestedRealm,
  assertSlugAvailable,
  assertSlugUniqueAfterWrite,
  invalidateRealmCache,
} from './realm.js';
import {
  buildImportedSettings,
  buildSlugById,
  exportRealmSettings,
  exportTeamRealm,
  parseImportedRealm,
  resolveAllowedHomeRealms,
} from './realmExport.logic.js';

/**
 * `realm` (and, for realm teams, `realmSettings`) of every team, keyed by team id.
 * Secrets are not selected from the database and are exported as null regardless.
 */
export async function buildTeamRealmExports(
  teams: Indexable[],
): Promise<Map<string, Indexable>> {
  const exports = new Map<string, Indexable>();
  const realmTeamIds = teams
    .filter(team => team.realm?.enabled === true)
    .map(team => String(team._id));
  const settings = realmTeamIds.length
    ? await RealmSettings.getInstance().findMany({ team: { $in: realmTeamIds } })
    : [];
  const settingsByTeam = new Map(settings.map(item => [String(item.team), item]));
  const slugById = buildSlugById(teams);
  for (const team of teams) {
    const id = String(team._id);
    const entry: Indexable = { realm: exportTeamRealm(team) };
    const stored = settingsByTeam.get(id);
    if (team.realm?.enabled === true && stored) {
      entry.realmSettings = exportRealmSettings(stored, slugById);
    }
    exports.set(id, entry);
  }
  return exports;
}

type PendingHomeRealms = {
  teamName: string;
  settingsId: string;
  settings: Indexable;
  slugs: string[];
};

/**
 * Applies the `realm` / `realmSettings` of exported team records on teams that already
 * exist (by name, with their parents set). Upserts RealmSettings by team and never
 * imports secrets. Errors are recorded per team in `result`; teams that are realms in
 * the database but not in the file are left alone (demotion is destructive).
 * Returns whether any realm was written.
 */
export async function importTeamRealms(
  records: Indexable[],
  result: ImportResult[string],
): Promise<boolean> {
  const pending: PendingHomeRealms[] = [];
  let changed = false;
  for (const rec of records) {
    const name = rec.name as string;
    if (!name) continue;
    try {
      const parsed = parseImportedRealm(rec);
      if (!parsed.enabled) continue;
      const team = await Team.getInstance().findOne(
        { name },
        { readPreference: 'primary' },
      );
      if (!team) continue;
      const teamId = String(team._id);
      await assertNoNestedRealm(teamId, undefined, { promote: true });
      await assertSlugAvailable(parsed.slug, teamId);

      const existing = await RealmSettings.getInstance().findOne(
        { team: teamId },
        { select: '+oauthSecrets', readPreference: 'primary' },
      );
      const { settings, oauthSecrets } = buildImportedSettings({
        input: parsed.input,
        existingSecrets: existing?.oauthSecrets,
      });
      let settingsId: string;
      if (existing) {
        await RealmSettings.getInstance().findByIdAndUpdate(existing._id, {
          ...settings,
          oauthSecrets,
        } as Indexable);
        settingsId = String(existing._id);
      } else {
        const created = await RealmSettings.getInstance().create({
          team: teamId,
          ...settings,
          oauthSecrets,
        } as Indexable);
        settingsId = String(created._id);
      }
      const previousRealm = team.realm;
      await Team.getInstance().findByIdAndUpdate(teamId, {
        realm: { enabled: true, slug: parsed.slug },
      });
      changed = true;
      try {
        await assertSlugUniqueAfterWrite(parsed.slug, teamId);
      } catch (e) {
        await Team.getInstance()
          .findByIdAndUpdate(teamId, { realm: previousRealm ?? { enabled: false } })
          .catch(err => ConduitGrpcSdk.Logger.error(err as Error));
        throw e;
      }
      if (parsed.allowedHomeRealmSlugs !== undefined) {
        pending.push({
          teamName: name,
          settingsId,
          settings,
          slugs: parsed.allowedHomeRealmSlugs,
        });
      }
    } catch (e) {
      result.failed += 1;
      result.errors.push(`${name}: realm: ${(e as Error).message}`);
    }
  }

  // trusted home realms refer to other realms: resolve them once all slugs are in place
  for (const item of pending) {
    try {
      const idBySlug = new Map<string, string>();
      for (const slug of item.slugs) {
        const query: Indexable = { 'realm.slug': slug, 'realm.enabled': true };
        const realmTeam = await Team.getInstance().findOne(query, {
          readPreference: 'primary',
        });
        if (realmTeam) idBySlug.set(slug, String(realmTeam._id));
      }
      const { ids, missing } = resolveAllowedHomeRealms(item.slugs, idBySlug);
      await RealmSettings.getInstance().findByIdAndUpdate(item.settingsId, {
        policies: {
          ...item.settings.policies,
          guests: { ...item.settings.policies.guests, allowedHomeRealms: ids },
        },
      } as Indexable);
      if (missing.length > 0) {
        result.failed += 1;
        result.errors.push(
          `${item.teamName}: realm: trusted home realms not found: ${missing.join(', ')}`,
        );
      }
    } catch (e) {
      result.failed += 1;
      result.errors.push(`${item.teamName}: realm: ${(e as Error).message}`);
    }
  }
  if (changed) invalidateRealmCache();
  return changed;
}

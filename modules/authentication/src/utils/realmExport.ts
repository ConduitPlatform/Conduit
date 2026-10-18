/**
 * IO side of the realm GitOps export/import. The transforms live in
 * ./realmExport.logic.ts.
 */
import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';

import { RealmSettings, Team } from '../models/index.js';
import { assertTeamPromotable } from '../admin/realm.logic.js';
import { promoteTeamToRealm } from '../admin/realm.js';
import {
  assertNoNestedRealm,
  assertSlugAvailable,
  assertSlugUniqueAfterWrite,
  invalidateRealmCache,
  normalizeIdList,
} from './realm.js';
import {
  applyTrustedHomeRealms,
  buildImportedSettings,
  buildSlugById,
  decideTrustedHomeRealms,
  exportRealmSettings,
  exportTeamRealm,
  ImportedRealm,
  ImportTally,
  parseImportedRealm,
  topLevelTeamQuery,
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

type EnabledRealm = Extract<ImportedRealm, { enabled: true }>;

type PreparedRealm = {
  index: number;
  name: string;
  team: Team;
  parsed: EnabledRealm;
};

/**
 * Slug -> realm team id for every trusted home realm the file names, resolved before
 * anything is written: the realms of the file itself win (their teams become realms
 * under that slug), the rest comes from the realms in the database. A slug that is in
 * neither is simply absent: the caller fails closed (see decideTrustedHomeRealms).
 */
async function resolveTrustedSlugs(
  prepared: PreparedRealm[],
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const item of prepared) {
    if (!idBySlug.has(item.parsed.slug)) {
      idBySlug.set(item.parsed.slug, String(item.team._id));
    }
  }
  const wanted = new Set<string>();
  for (const item of prepared) {
    for (const slug of item.parsed.allowedHomeRealmSlugs ?? []) {
      if (!idBySlug.has(slug)) wanted.add(slug);
    }
  }
  if (wanted.size > 0) {
    const query: Indexable = {
      'realm.slug': { $in: Array.from(wanted) },
      'realm.enabled': true,
    };
    const realmTeams = await Team.getInstance().findMany(query, {
      readPreference: 'primary',
    });
    for (const realmTeam of realmTeams) {
      const slug = realmTeam.realm?.slug;
      if (slug && !idBySlug.has(slug)) idBySlug.set(slug, String(realmTeam._id));
    }
  }
  return idBySlug;
}

/** Overwrites the settings of a team that is already a realm (the file wins). */
async function updateExistingRealm(
  team: Team,
  slug: string,
  stored: Indexable | null,
  write: { settings: Indexable; oauthSecrets: Indexable },
): Promise<void> {
  const teamId = String(team._id);
  await assertNoNestedRealm(teamId, undefined, { promote: true });
  await assertSlugAvailable(slug, teamId);

  const previousRealm = team.realm;
  const previousSettings = stored
    ? {
        active: stored.active,
        strategies: stored.strategies,
        registration: stored.registration,
        policies: stored.policies,
        oauthSecrets: stored.oauthSecrets ?? {},
      }
    : null;
  const restore = async () => {
    // best effort, never masks the error that triggered it
    await Team.getInstance()
      .findByIdAndUpdate(teamId, { realm: previousRealm ?? { enabled: false } })
      .catch(err => ConduitGrpcSdk.Logger.error(err as Error));
    if (stored && previousSettings) {
      await RealmSettings.getInstance()
        .findByIdAndUpdate(stored._id, previousSettings as Indexable)
        .catch(err => ConduitGrpcSdk.Logger.error(err as Error));
    } else {
      await RealmSettings.getInstance()
        .deleteMany({ team: teamId })
        .catch(err => ConduitGrpcSdk.Logger.error(err as Error));
    }
  };

  try {
    if (stored) {
      await RealmSettings.getInstance().findByIdAndUpdate(stored._id, {
        ...write.settings,
        oauthSecrets: write.oauthSecrets,
      } as Indexable);
    } else {
      await RealmSettings.getInstance().create({
        team: teamId,
        ...write.settings,
        oauthSecrets: write.oauthSecrets,
      } as Indexable);
    }
    await Team.getInstance().findByIdAndUpdate(teamId, {
      realm: { enabled: true, slug },
    });
    await assertSlugUniqueAfterWrite(slug, teamId);
  } catch (e) {
    await restore();
    throw e;
  }
}

/**
 * Applies the `realm` / `realmSettings` of exported team records on teams that already
 * exist (by name, with their parents set). Realms are top-level, so the team is looked up
 * by name on the top level. Never imports secrets (the ones stored are kept).
 *  - a team that is not a realm yet goes through `promoteTeamToRealm`, like the admin
 *    route: its existing members become home users / guests, a guest the realm refuses
 *    fails the team (nothing written for it);
 *  - a realm that exists is overwritten with the file's settings;
 *  - realms that are in the database but not (enabled) in the file are left alone
 *    (demotion is destructive);
 *  - trusted home realm slugs are resolved before the first write and fail closed: an
 *    unresolved entry keeps the stored list of an existing realm, or disables guests of a
 *    new one, and the team is reported as failed.
 * Every problem is recorded on `tally` per record. Returns whether any realm was written.
 */
export async function importTeamRealms(
  grpcSdk: ConduitGrpcSdk,
  records: Indexable[],
  tally: ImportTally,
): Promise<boolean> {
  const prepared: PreparedRealm[] = [];
  for (let index = 0; index < records.length; index++) {
    const rec = records[index];
    const name = rec.name as string;
    if (!name) continue;
    try {
      const parsed = parseImportedRealm(rec);
      if (!parsed.enabled) continue;
      const team = await Team.getInstance().findOne(topLevelTeamQuery(name), {
        readPreference: 'primary',
      });
      if (!team)
        throw new Error('no top-level team with this name (realms are top-level)');
      prepared.push({ index, name, team, parsed });
    } catch (e) {
      tally.failed(index, `${name}: realm: ${(e as Error).message}`);
    }
  }
  if (prepared.length === 0) return false;

  let idBySlug: Map<string, string>;
  try {
    idBySlug = await resolveTrustedSlugs(prepared);
  } catch (e) {
    // nothing was written: fail every realm rather than guessing the trusted realms
    for (const item of prepared) {
      tally.failed(item.index, `${item.name}: realm: ${(e as Error).message}`);
    }
    return false;
  }

  let changed = false;
  for (const { index, name, team, parsed } of prepared) {
    try {
      const teamId = String(team._id);
      const isRealm = team.realm?.enabled === true;
      const stored = isRealm
        ? await RealmSettings.getInstance().findOne(
            { team: teamId },
            { select: '+oauthSecrets', readPreference: 'primary' },
          )
        : null;
      const decision = decideTrustedHomeRealms({
        slugs: parsed.allowedHomeRealmSlugs,
        unresolved: parsed.unresolvedHomeRealms,
        idBySlug,
        storedIds: stored
          ? normalizeIdList(stored.policies?.guests?.allowedHomeRealms)
          : null,
      });
      const built = buildImportedSettings({
        input: parsed.input,
        existingSecrets: stored?.oauthSecrets,
      });
      const settings = applyTrustedHomeRealms(built.settings, decision);

      if (isRealm) {
        await updateExistingRealm(team, parsed.slug, stored, {
          settings,
          oauthSecrets: built.oauthSecrets,
        });
      } else {
        assertTeamPromotable(team);
        await promoteTeamToRealm(
          grpcSdk,
          team,
          { slug: parsed.slug, settings, oauthSecrets: built.oauthSecrets },
          { notify: false },
        );
      }
      changed = true;
      if (decision && decision.missing.length > 0) {
        tally.failed(
          index,
          `${name}: realm: trusted home realms not found: ${decision.missing.join(', ')}` +
            (decision.disallowGuests
              ? ' (guests are disabled until they are set)'
              : ' (kept the stored list)'),
        );
      }
    } catch (e) {
      tally.failed(index, `${name}: realm: ${(e as Error).message}`);
    }
  }
  if (changed) invalidateRealmCache();
  return changed;
}

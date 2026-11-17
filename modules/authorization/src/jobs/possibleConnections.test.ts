import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectIndex, ResourceDefinition } from '../models/index.js';
import { constructObjectIndex } from '../utils/index.js';
import { FakeObjectIndexStore } from '../testing/fakeObjectIndexStore.js';
import {
  processPossibleConnections,
  ProcessPossibleConnectionsWorkerData,
} from './possibleConnections.js';

const DEFINITIONS: Record<string, { permissions: Record<string, string[]> }> = {
  Org: { permissions: { read: ['owner'], edit: ['owner'] } },
  Team: { permissions: { read: ['owner', 'readAll'], edit: ['owner'] } },
  ScheduledSessions: { permissions: { read: ['owner', 'owner->read'] } },
  Session: { permissions: { read: ['owner', 'owner->read'] } },
  Folder: { permissions: { read: ['owner', 'owner->read'] } },
  File: { permissions: { read: ['owner', 'owner->read'] } },
  // read is only inherited: no direct role, so a fresh group has no read rows
  Group: { permissions: { read: ['owner->read'] } },
  // everyone can read
  Public: { permissions: { read: ['*'] } },
};

const ORG = 'Org:o';
const TEAM = 'Team:fam';
const SCHEDULE = 'ScheduledSessions:x';
const SESSION = 'Session:s';

/** Data constructRelationIndex queues for `subject owner object` with these definitions. */
function ownerJob(
  subject: string,
  object: string,
  relatedPermissions: Record<string, string[]> = { read: ['read'] },
  achievedPermissions: string[] = ['read'],
) {
  return {
    object,
    subject,
    relation: 'owner',
    relatedPermissions,
    achievedPermissions,
  } as ProcessPossibleConnectionsWorkerData;
}

describe('processPossibleConnections', () => {
  const store = new FakeObjectIndexStore();
  const process = processPossibleConnections;
  /** J1: the family team becomes owner of the schedule. */
  const teamOwnsSchedule = () => process(ownerJob(TEAM, SCHEDULE));
  /** J3: the schedule becomes owner of the session (a scoped create). */
  const scheduleOwnsSession = () => process(ownerJob(SCHEDULE, SESSION));
  /** The org becomes owner of the family team. */
  const orgOwnsTeam = () => process(ownerJob(ORG, TEAM));

  const keysOf = (rows: Partial<ObjectIndex>[]) =>
    rows.map(r => `${r.subject}|${r.entity}|${(r.inheritanceTree ?? []).join(',')}`);

  const teamEntitiesOnSession = () =>
    store
      .entitiesOf(`${SESSION}#read`)
      .filter(row => row.entity?.startsWith('Team:'))
      .map(row => ({
        entity: row.entity,
        relation: row.relation,
        inheritanceTree: row.inheritanceTree,
      }))
      .sort((a, b) => a.entity!.localeCompare(b.entity!));

  const expectedTeamEntities = [
    {
      entity: `${TEAM}#owner`,
      relation: 'owner',
      inheritanceTree: [`${TEAM}#owner@${SCHEDULE}`, `${SCHEDULE}#owner@${SESSION}`],
    },
    {
      entity: `${TEAM}#readAll`,
      relation: 'readAll',
      inheritanceTree: [`${TEAM}#owner@${SCHEDULE}`, `${SCHEDULE}#owner@${SESSION}`],
    },
  ];

  beforeEach(() => {
    store.reset();
    // Base rows constructRelationIndex writes synchronously before queueing each job.
    store.seed([
      constructObjectIndex(ORG, 'read', 'owner', ORG, []),
      constructObjectIndex(TEAM, 'read', 'owner', TEAM, []),
      constructObjectIndex(TEAM, 'read', 'readAll', TEAM, []),
      constructObjectIndex(SCHEDULE, 'read', 'owner', SCHEDULE, []),
      constructObjectIndex(SESSION, 'read', 'owner', SESSION, []),
    ]);
    mock.method(ObjectIndex, 'getInstance', () => store as unknown as ObjectIndex);
    mock.method(
      ResourceDefinition,
      'getInstance',
      () =>
        ({
          findOne: async ({ name }: { name: string }) => ({
            name,
            ...DEFINITIONS[name],
          }),
        }) as unknown as ResourceDefinition,
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('gives the session the team entities when the team job runs first', async () => {
    await teamOwnsSchedule();
    await scheduleOwnsSession();

    assert.deepStrictEqual(teamEntitiesOnSession(), expectedTeamEntities);
  });

  it('pushes the team entities down when the team job runs after the session was indexed', async () => {
    await scheduleOwnsSession();
    await teamOwnsSchedule();

    assert.deepStrictEqual(teamEntitiesOnSession(), expectedTeamEntities);
  });

  it('closes the gap when the session job reads the schedule before the team job writes it', async () => {
    // Pause the session job at its first read of the schedule's rows, run the whole
    // team job (its push-down finds no session rows yet), then let the session job write.
    let release!: () => void;
    const paused = new Promise<void>(resolve => (release = resolve));
    let reachedRead!: () => void;
    const atRead = new Promise<void>(resolve => (reachedRead = resolve));
    let gated = false;
    store.afterFind = async query => {
      const subjects = (query.subject as { $in?: string[] } | undefined)?.$in;
      if (!gated && subjects?.includes(`${SCHEDULE}#read`)) {
        gated = true;
        reachedRead();
        await paused;
      }
    };

    const sessionJob = scheduleOwnsSession();
    await atRead;
    store.afterFind = async () => {};
    await teamOwnsSchedule();
    release();
    await sessionJob;

    assert.deepStrictEqual(teamEntitiesOnSession(), expectedTeamEntities);
  });

  it('marks the session row with the schedule permission it came from', async () => {
    await scheduleOwnsSession();

    const fromSchedule = store
      .entitiesOf(`${SESSION}#read`)
      .filter(row => row.entity === `${SCHEDULE}#owner`);
    assert.equal(fromSchedule.length, 1);
    assert.equal(fromSchedule[0]?.entityPermission, 'read');
  });

  it('pushes a parent added last through every hop in the normal job order', async () => {
    await teamOwnsSchedule();
    await scheduleOwnsSession();
    await orgOwnsTeam();

    const orgOnSession = store
      .entitiesOf(`${SESSION}#read`)
      .filter(row => row.entity?.startsWith('Org:'))
      .map(row => ({
        entity: row.entity,
        relation: row.relation,
        tree: row.inheritanceTree,
      }));
    assert.deepStrictEqual(orgOnSession, [
      {
        entity: `${ORG}#owner`,
        relation: 'owner',
        tree: [
          `${ORG}#owner@${TEAM}`,
          `${TEAM}#owner@${SCHEDULE}`,
          `${SCHEDULE}#owner@${SESSION}`,
        ],
      },
    ]);
  });

  it('backfills the marker on a pre-existing unmarked session row so later parents reach it', async () => {
    // As written before the marker was kept.
    store.seed([
      {
        ...constructObjectIndex(SESSION, 'read', 'owner', SCHEDULE, [
          `${SCHEDULE}#owner@${SESSION}`,
        ]),
      },
    ]);

    await scheduleOwnsSession(); // a re-index
    const fromSchedule = store
      .entitiesOf(`${SESSION}#read`)
      .filter(row => row.entity === `${SCHEDULE}#owner`);
    assert.equal(fromSchedule.length, 1);
    assert.equal(fromSchedule[0]?.entityPermission, 'read');

    await teamOwnsSchedule();
    assert.deepStrictEqual(teamEntitiesOnSession(), expectedTeamEntities);
  });

  it('leaves one copy when two jobs insert the same rows at once', async () => {
    // Hold every job at its existence check until both have read, so both see the
    // rows as missing and both insert them.
    let arrived = 0;
    let releaseAll!: () => void;
    const bothRead = new Promise<void>(resolve => (releaseAll = resolve));
    store.afterFind = async query => {
      if (!('key' in query) || arrived >= 2) return;
      arrived++;
      if (arrived === 2) releaseAll();
      await bothRead;
    };

    await Promise.all([scheduleOwnsSession(), scheduleOwnsSession()]);

    const keys = keysOf(store.rows);
    assert.ok(keys.length > 0);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('propagates through same-type nesting (Folder in Folder)', async () => {
    const OUTER = 'Folder:a';
    const INNER = 'Folder:b';
    const FILE = 'File:f';
    store.seed([
      constructObjectIndex(OUTER, 'read', 'owner', OUTER, []),
      constructObjectIndex(INNER, 'read', 'owner', INNER, []),
      constructObjectIndex(FILE, 'read', 'owner', FILE, []),
    ]);

    await process(ownerJob(INNER, FILE));
    await process(ownerJob(OUTER, INNER));

    const outerOnFile = store
      .entitiesOf(`${FILE}#read`)
      .filter(row => row.entity === `${OUTER}#owner`)
      .map(row => ({ relation: row.relation, tree: row.inheritanceTree }));
    assert.deepStrictEqual(outerOnFile, [
      { relation: 'owner', tree: [`${OUTER}#owner@${INNER}`, `${INNER}#owner@${FILE}`] },
    ]);
  });

  it('keeps one marker per inheriting action so either action pushes down', async () => {
    // X#read is reached through both owner->read and owner->edit on its owner team.
    await process(ownerJob(TEAM, SCHEDULE, { read: ['read'], edit: ['read'] }));
    const markers = store
      .entitiesOf(`${SCHEDULE}#read`)
      .filter(row => row.entity === `${TEAM}#owner`)
      .map(row => row.entityPermission)
      .sort();
    assert.deepStrictEqual(markers, ['edit', 'read']);

    // The org later gets only edit on the team; it must still reach the schedule.
    store.seed([constructObjectIndex(ORG, 'edit', 'owner', ORG, [])]);
    await process(ownerJob(ORG, TEAM, { edit: ['edit'] }, ['edit']));

    const orgOnSchedule = store
      .entitiesOf(`${SCHEDULE}#read`)
      .filter(row => row.entity === `${ORG}#owner`)
      .map(row => ({ marker: row.entityPermission, tree: row.inheritanceTree }));
    assert.deepStrictEqual(orgOnSchedule, [
      { marker: 'edit', tree: [`${ORG}#owner@${TEAM}`, `${TEAM}#owner@${SCHEDULE}`] },
    ]);
  });
  /** Seeds an unmarked `Schedule#read ← Team#owner` row, as written before markers. */
  const seedUnmarkedScheduleRow = () =>
    store.seed([
      constructObjectIndex(SCHEDULE, 'read', 'owner', TEAM, [
        `${TEAM}#owner@${SCHEDULE}`,
      ]),
    ]);
  const markersOfTeamOwnerOnSchedule = () =>
    store
      .entitiesOf(`${SCHEDULE}#read`)
      .filter(row => row.entity === `${TEAM}#owner`)
      .map(row => row.entityPermission)
      .sort();
  const readJob = () => process(ownerJob(TEAM, SCHEDULE, { read: ['read'] }));
  const editJob = () => process(ownerJob(TEAM, SCHEDULE, { edit: ['read'] }, ['read']));

  it('keeps both markers when two jobs mark the same unmarked row at once', async () => {
    seedUnmarkedScheduleRow();
    // Both jobs read the unmarked row before either writes.
    let arrived = 0;
    let releaseAll!: () => void;
    const bothRead = new Promise<void>(resolve => (releaseAll = resolve));
    store.afterFind = async query => {
      if (!('key' in query) || arrived >= 2) return;
      arrived++;
      if (arrived === 2) releaseAll();
      await bothRead;
    };

    await Promise.all([readJob(), editJob()]);

    assert.deepStrictEqual(markersOfTeamOwnerOnSchedule(), ['edit', 'read']);
  });

  it('keeps a marker when another job deletes the unmarked row it read', async () => {
    seedUnmarkedScheduleRow();
    // The edit job reads the unmarked row, then the read job runs to completion
    // (including deleting the unmarked copy) before the edit job writes.
    let release!: () => void;
    const paused = new Promise<void>(resolve => (release = resolve));
    let reachedRead!: () => void;
    const atRead = new Promise<void>(resolve => (reachedRead = resolve));
    let gated = false;
    store.afterFind = async query => {
      if (!gated && 'key' in query) {
        gated = true;
        reachedRead();
        await paused;
      }
    };

    const edit = editJob();
    await atRead;
    await readJob();
    release();
    await edit;

    assert.deepStrictEqual(markersOfTeamOwnerOnSchedule(), ['edit', 'read']);
  });

  it('reaches a child linked through a purely inherited permission before its parent', async () => {
    const GROUP = 'Group:g';
    const FILE = 'File:f';
    const SUBFILE = 'File:sub';
    store.seed([
      constructObjectIndex(FILE, 'read', 'owner', FILE, []),
      constructObjectIndex(SUBFILE, 'read', 'owner', SUBFILE, []),
    ]);

    // The group has no read rows yet when the file is linked to it.
    await process(ownerJob(FILE, SUBFILE));
    await process(ownerJob(GROUP, FILE));
    // The group gains its read entities last.
    await process(ownerJob(ORG, GROUP));

    const orgOn = (resource: string) =>
      store
        .entitiesOf(`${resource}#read`)
        .filter(row => row.entity === `${ORG}#owner`)
        .map(row => row.inheritanceTree);
    assert.deepStrictEqual(orgOn(FILE), [
      [`${ORG}#owner@${GROUP}`, `${GROUP}#owner@${FILE}`],
    ]);
    assert.deepStrictEqual(orgOn(SUBFILE), [
      [`${ORG}#owner@${GROUP}`, `${GROUP}#owner@${FILE}`, `${FILE}#owner@${SUBFILE}`],
    ]);
    // Hook rows must never match an ActorIndex entity (always `resource#relation`).
    for (const row of store.rows.filter(r => r.relation?.startsWith('->'))) {
      assert.ok(!row.entity!.includes('#'), row.entity);
    }
  });
  it('passes a wildcard role down as the wildcard entity', async () => {
    const PUBLIC = 'Public:p';
    const FILE = 'File:f';

    await process(ownerJob(PUBLIC, FILE));

    // Readers grant everyone on entity '*'; `Public:p#*` would match no one.
    const fromPublic = store
      .entitiesOf(`${FILE}#read`)
      .filter(row => row.inheritanceTree?.length)
      .map(row => ({ entity: row.entity, entityId: row.entityId }));
    assert.deepStrictEqual(fromPublic, [{ entity: '*', entityId: '*' }]);
  });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { ObjectIndex, ResourceDefinition } from '../../models/index.js';
import { constructObjectIndex } from '../../utils/index.js';
import {
  createProcessPossibleConnectionsProcessor,
  ProcessPossibleConnectionsWorkerData,
} from '../processPossibleConnections.js';

type Row = Partial<ObjectIndex> & { _id: string };
type Query = Record<string, unknown>;

/** Just enough of the ObjectIndex model for the connection job's queries. */
class FakeObjectIndexStore {
  rows: Row[] = [];
  private nextId = 1;
  /** Runs after every findMany has read; lets a test pause a job holding a stale result. */
  afterFind: (query: Query) => Promise<void> = async () => {};

  seed(rows: Partial<ObjectIndex>[]) {
    for (const row of rows) this.rows.push({ ...row, _id: String(this.nextId++) });
  }

  findMany = async (query: Query) => {
    const result = this.rows.filter(row => matches(row, query)).map(row => ({ ...row }));
    await this.afterFind(query);
    return result;
  };

  createMany = async (rows: Partial<ObjectIndex>[]) => {
    this.seed(rows);
    return rows;
  };

  entitiesOf(subject: string) {
    return this.rows.filter(row => row.subject === subject);
  }
}

function matches(row: Row, query: Query): boolean {
  return Object.entries(query).every(([field, condition]) => {
    if (field === '$and') return (condition as Query[]).every(q => matches(row, q));
    const value = (row as Record<string, unknown>)[field] ?? '';
    if (condition && typeof condition === 'object') {
      const c = condition as { $in?: unknown[]; $ne?: unknown };
      if (c.$in) return c.$in.includes(value);
      if ('$ne' in c) return value !== c.$ne;
    }
    return value === condition;
  });
}

const DEFINITIONS: Record<string, { permissions: Record<string, string[]> }> = {
  Team: { permissions: { read: ['owner', 'readAll'] } },
  ScheduledSessions: { permissions: { read: ['owner', 'owner->read'] } },
  Session: { permissions: { read: ['owner', 'owner->read'] } },
};

const TEAM = 'Team:fam';
const SCHEDULE = 'ScheduledSessions:x';
const SESSION = 'Session:s';

/** Data constructRelationIndex queues for `subject owner object` with these definitions. */
function ownerJob(subject: string, object: string) {
  return {
    data: {
      object,
      subject,
      relation: 'owner',
      relatedPermissions: { read: ['read'] },
      achievedPermissions: ['read'],
    },
  } as Job<ProcessPossibleConnectionsWorkerData>;
}

describe('processPossibleConnections', () => {
  const store = new FakeObjectIndexStore();
  const process = createProcessPossibleConnectionsProcessor();
  /** J1: the family team becomes owner of the schedule. */
  const teamOwnsSchedule = () => process(ownerJob(TEAM, SCHEDULE));
  /** J3: the schedule becomes owner of the session (a scoped create). */
  const scheduleOwnsSession = () => process(ownerJob(SCHEDULE, SESSION));

  const teamEntitiesOnSession = () =>
    store
      .entitiesOf(`${SESSION}#read`)
      .filter(row => row.entity?.startsWith('Team:'))
      .map(row => ({ entity: row.entity, inheritanceTree: row.inheritanceTree }))
      .sort((a, b) => a.entity!.localeCompare(b.entity!));

  const expectedTeamEntities = [
    {
      entity: `${TEAM}#owner`,
      inheritanceTree: [`${TEAM}#owner@${SCHEDULE}`, `${SCHEDULE}#owner@${SESSION}`],
    },
    {
      entity: `${TEAM}#readAll`,
      inheritanceTree: [`${TEAM}#owner@${SCHEDULE}`, `${SCHEDULE}#owner@${SESSION}`],
    },
  ];

  beforeEach(() => {
    store.rows = [];
    store.afterFind = async () => {};
    // Base rows constructRelationIndex writes synchronously before queueing each job.
    store.seed([
      constructObjectIndex(TEAM, 'read', 'owner', TEAM, []),
      constructObjectIndex(TEAM, 'read', 'readAll', TEAM, []),
      constructObjectIndex(SCHEDULE, 'read', 'owner', SCHEDULE, []),
      constructObjectIndex(SESSION, 'read', 'owner', SESSION, []),
    ]);
    jest
      .spyOn(ObjectIndex, 'getInstance')
      .mockReturnValue(store as unknown as ObjectIndex);
    jest.spyOn(ResourceDefinition, 'getInstance').mockReturnValue({
      findOne: async ({ name }: { name: string }) => ({ name, ...DEFINITIONS[name] }),
    } as unknown as ResourceDefinition);
  });

  it('gives the session the team entities when the team job runs first', async () => {
    await teamOwnsSchedule();
    await scheduleOwnsSession();

    expect(teamEntitiesOnSession()).toEqual(expectedTeamEntities);
  });

  it('pushes the team entities down when the team job runs after the session was indexed', async () => {
    await scheduleOwnsSession();
    await teamOwnsSchedule();

    expect(teamEntitiesOnSession()).toEqual(expectedTeamEntities);
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

    expect(teamEntitiesOnSession()).toEqual(expectedTeamEntities);
  });

  it('marks the session row with the schedule permission it came from', async () => {
    await scheduleOwnsSession();

    const fromSchedule = store
      .entitiesOf(`${SESSION}#read`)
      .filter(row => row.entity === `${SCHEDULE}#owner`);
    expect(fromSchedule).toHaveLength(1);
    expect(fromSchedule[0]?.entityPermission).toBe('read');
  });
});

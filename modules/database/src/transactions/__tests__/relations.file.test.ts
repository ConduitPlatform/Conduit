import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataTypes, Sequelize } from 'sequelize';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { SequelizeAdapter } from '../../adapters/sequelize-adapter/index.js';
import { createSequelize } from '../../adapters/sequelize-adapter/utils/sqlite.js';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';

const postgresUri = process.env.DB_CONN_URI?.startsWith('postgres')
  ? process.env.DB_CONN_URI
  : undefined;
const databases: [string, (dir: string) => string][] = [
  ['SQLite', dir => `sqlite:${join(dir, 'test.sqlite')}`],
  ...(postgresUri ? [['PostgreSQL', () => postgresUri] as [string, () => string]] : []),
];

describe.each(databases)('relations inside a transaction (%s)', (_name, uriFor) => {
  let dir: string;
  let sequelize: Sequelize;
  let adapter: SequelizeAdapter;
  let member: SequelizeSchema;
  let room: SequelizeSchema;
  const rejections: unknown[] = [];
  const onRejection = (e: unknown) => rejections.push(e);

  const build = (
    name: string,
    fields: object,
    relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
  ) =>
    new SequelizeSchema(
      {} as ConduitGrpcSdk,
      sequelize,
      {
        collectionName: `tx_${name.toLowerCase()}`,
        fields: { name: { type: DataTypes.STRING } },
        modelOptions: {},
      },
      {
        name,
        collectionName: `tx_${name.toLowerCase()}`,
        fields,
        compiledFields: fields,
        modelOptions: {},
      } as unknown as ConduitDatabaseSchema,
      adapter,
      relations,
      {},
    );

  beforeAll(async () => {
    process.on('unhandledRejection', onRejection);
    dir = mkdtempSync(join(tmpdir(), 'conduit-tx-relations-'));
    sequelize = createSequelize(uriFor(dir));
    adapter = Object.assign(Object.create(SequelizeAdapter.prototype), { sequelize });
    // a shared PostgreSQL database keeps the tables of earlier runs
    for (const table of ['tx_room_Member', 'tx_room', 'tx_member']) {
      await sequelize.getQueryInterface().dropTable(table, { cascade: true });
    }
    member = build('Member', { name: { type: 'String' } }, {});
    await member.sync();
    room = build(
      'Room',
      {
        name: { type: 'String' },
        members: [{ type: 'Relation', model: 'Member' }],
        owner: { type: 'Relation', model: 'Member' },
      },
      { members: [member], owner: member },
    );
    await room.sync();
  });

  afterAll(async () => {
    process.off('unhandledRejection', onRejection);
    await sequelize.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes relations with the transaction and drops them on rollback', async () => {
    const [a, b] = await Promise.all([
      member.create({ name: 'a' }),
      member.create({ name: 'b' }),
    ]);

    const rolledBack = await adapter.beginTransaction();
    const ghost = await room.create(
      { name: 'ghost', members: [a._id, b._id], owner: a._id },
      { transaction: rolledBack },
    );
    await adapter.rollbackTransaction(rolledBack);
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(await room.findOne({ _id: ghost._id })).toBeNull();
    const through = sequelize.models[`${room.model.name}_Member`];
    expect(await through.count()).toBe(0);

    const committed = await adapter.beginTransaction();
    const created = await room.create(
      { name: 'kept', members: [a._id], owner: a._id },
      { transaction: committed },
    );
    await room.findByIdAndUpdate(
      created._id,
      { members: [a._id, b._id] },
      { transaction: committed },
    );
    await adapter.commitTransaction(committed);
    await new Promise(resolve => setTimeout(resolve, 300));

    const stored = await room.findOne({ _id: created._id }, { populate: ['members'] });
    expect(stored.members.map((m: { name: string }) => m.name).sort()).toEqual([
      'a',
      'b',
    ]);
    expect(rejections).toEqual([]);
  });
});

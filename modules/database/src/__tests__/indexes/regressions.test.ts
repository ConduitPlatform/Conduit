import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from '@jest/globals';

function repoFile(...parts: string[]) {
  const candidates = [
    resolve(process.cwd(), '..', ...parts),
    resolve(process.cwd(), ...parts),
    resolve(process.cwd(), '../..', ...parts),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing ${parts.join('/')}`);
  return found;
}

describe('platform models use CompatibleIndexType', () => {
  it('authz and chat schemas declare Compatible indexes, not Mongo-only types', () => {
    const files = [
      repoFile('authorization', 'src', 'models', 'Permission.schema.ts'),
      repoFile('authorization', 'src', 'models', 'Relationship.schema.ts'),
      repoFile('authorization', 'src', 'models', 'ActorIndex.schema.ts'),
      repoFile('authorization', 'src', 'models', 'ObjectIndex.schema.ts'),
      repoFile('chat', 'src', 'models', 'ChatRoom.schema.ts'),
      repoFile('chat', 'src', 'models', 'Message.schema.ts'),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('CompatibleIndexType');
      expect(source).not.toContain('MongoIndexType');
    }
  });
});

describe('do not port old PR #643 bugs', () => {
  it("does not use `case 'mysql' || 'mariadb'`", () => {
    const files = [
      resolve(process.cwd(), 'src/adapters/utils/indexes.ts'),
      resolve(process.cwd(), 'src/adapters/sequelize-adapter/index.ts'),
      resolve(process.cwd(), 'src/adapters/utils/database-transform-utils.ts'),
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/case ['"]mysql['"]\s*\|\|/);
    }
  });

  it('does not rename getDatabaseType PostgreSQL to postgres', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/adapters/sequelize-adapter/index.ts'),
      'utf8',
    );
    expect(source).toContain("return 'PostgreSQL'");
  });

  it('does not use metadata-only getIndexes or createSchemaFromAdapter rebuild for indexes', () => {
    const sequelize = readFileSync(
      resolve(process.cwd(), 'src/adapters/sequelize-adapter/index.ts'),
      'utf8',
    );
    expect(sequelize).toContain('showIndex');
    expect(sequelize).toContain('addIndex');
    expect(sequelize).not.toMatch(/createIndexes[\s\S]*createSchemaFromAdapter/);
    expect(sequelize).not.toMatch(/await this\.models\[schemaName\]\.sync\(\)/);
  });
});

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from '@jest/globals';

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

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

const files = [
  repoFile('authorization', 'src', 'models', 'Permission.schema.ts'),
  repoFile('authorization', 'src', 'models', 'Relationship.schema.ts'),
  repoFile('authorization', 'src', 'models', 'ActorIndex.schema.ts'),
  repoFile('authorization', 'src', 'models', 'ObjectIndex.schema.ts'),
  repoFile('chat', 'src', 'models', 'ChatRoom.schema.ts'),
  repoFile('chat', 'src', 'models', 'Message.schema.ts'),
];

describe('platform models T7 CompatibleIndexType', () => {
  it('authz + chat schemas declare Compatible indexes, not Mongo-only types', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('CompatibleIndexType');
      expect(source).not.toContain('MongoIndexType');
    }
  });
});

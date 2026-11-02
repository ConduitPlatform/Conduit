import { describe, expect, it } from '@jest/globals';
import {
  assertPermissionAction,
  getPostgresAccessListQuery,
  getSQLAccessListQuery,
} from '../index.js';

describe('permission action validation', () => {
  it('accepts snake_case actions and rejects other characters', () => {
    expect(() => assertPermissionAction('overview_read')).not.toThrow();
    expect(() => assertPermissionAction('viewMembers')).not.toThrow();
    expect(() => assertPermissionAction('overview-read')).toThrow(
      'Action must start with a letter and contain only letters, numbers, and underscores',
    );
  });
});

describe('direct permission SQL filters', () => {
  it('matches subject, action, and resource type without LIKE wildcards', () => {
    const postgres = getPostgresAccessListQuery(
      'cnd_team',
      "O'Brien:1",
      'Team',
      'trips_read',
    );
    const sqlite = getSQLAccessListQuery('cnd_team', "O'Brien:1", 'Team', 'trips_read');

    for (const query of [postgres, sqlite]) {
      expect(query).not.toContain('LIKE');
      expect(query).toContain("subject = 'O''Brien:1'");
      expect(query).toContain("permission = 'trips_read'");
    }
    expect(postgres).toContain(`p."resourceType" = 'Team'`);
    expect(sqlite).toContain(`p.resourceType = 'Team'`);
  });
});

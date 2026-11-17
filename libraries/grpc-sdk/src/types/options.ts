export type AuthzOptions = {
  userId?: string;
  scope?: string;
};

export type CreateManyOptions = {
  /**
   * Skip documents that would violate a unique index instead of failing the call.
   * Only the documents actually inserted are guaranteed to be in the result.
   *
   * On MySQL/MariaDB this is `INSERT IGNORE`, which also turns other row errors
   * (NOT NULL violations, truncation, invalid values) into warnings and drops those
   * rows silently. MongoDB, PostgreSQL and SQLite skip unique conflicts only.
   */
  ignoreDuplicates?: boolean;
} & AuthzOptions;

export type PopulateAuthzOptions = {
  populate?: string | string[];
} & AuthzOptions;

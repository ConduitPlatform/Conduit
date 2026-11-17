export type AuthzOptions = {
  userId?: string;
  scope?: string;
};

export type CreateManyOptions = {
  /**
   * Skip documents that would violate a unique index instead of failing the call.
   * Only the documents actually inserted are guaranteed to be in the result.
   */
  ignoreDuplicates?: boolean;
} & AuthzOptions;

export type PopulateAuthzOptions = {
  populate?: string | string[];
} & AuthzOptions;

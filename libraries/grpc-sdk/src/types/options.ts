export type AuthzOptions = {
  userId?: string;
  scope?: string;
};

export type PopulateAuthzOptions = {
  populate?: string | string[];
  /**
   * When true, Database skips publishing the mutation event.
   * Existing callers omit this and keep the default publish behavior.
   */
  suppressEvent?: boolean;
} & AuthzOptions;

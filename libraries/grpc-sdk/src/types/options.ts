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
  /**
   * When true, Database verifies the caller is the embeddings module
   * and restricts the write to embeddings-owned vector/hash fields.
   */
  embeddingsJob?: boolean;
} & AuthzOptions;

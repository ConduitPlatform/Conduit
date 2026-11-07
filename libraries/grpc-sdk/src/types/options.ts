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
  /**
   * When both are set, Database updates this document and the guard document
   * in one transaction. A miss comes back as null. userId and scope are rejected.
   */
  guardSchema?: string;
  guardFilter?: { [key: string]: unknown };
} & AuthzOptions;

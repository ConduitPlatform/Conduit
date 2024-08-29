export type AuthzOptions = {
  userId?: string;
  scope?: string;
};

export type PopulateAuthzOptions = {
  populate?: string | string[];
} & AuthzOptions;

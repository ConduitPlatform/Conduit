export interface ConnectionParams {
  accessToken: string;
  clientId: string;
  scope: string;
  /** The OAuth client id of the provider app the flow ran with (the realm's, if any). */
  providerClientId?: string;
}

export interface ConnectionParams {
  accessToken: string;
  clientId: string;
  scope: string;
  /** The OAuth client id of the provider app the flow ran with (the realm's, if any). */
  providerClientId?: string;
  /** Client secret of the provider app the flow ran with. */
  providerClientSecret?: string;
  /** Set when the client supplied the provider token (native login). */
  native?: boolean;
  /** Provider id_token supplied by the client (native login). */
  idToken?: string;
}

export interface ProviderConfig {
  accountLinking: boolean;
  clientId: string;
  clientSecret: string;
  redirect_uri: string;
  privateKey?: string;
}

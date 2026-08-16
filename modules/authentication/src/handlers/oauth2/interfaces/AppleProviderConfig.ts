import { ProviderConfig } from './ProviderConfig.js';

export interface AppleClientCredentials {
  clientId: string;
  privateKey: string;
  teamId: string;
  keyId: string;
}

export interface AppleOAuthClientConfig {
  id: string;
  name?: string;
  clientId: string;
  privateKey?: string;
  teamId?: string;
  keyId?: string;
  redirect_uri?: string;
}

export interface ResolvedAppleOAuthClient extends AppleClientCredentials {
  redirect_uri: string;
}

export interface AppleProviderConfig extends ProviderConfig {
  privateKey: string;
  teamId: string;
  keyId: string;
  clients?: AppleOAuthClientConfig[];
}

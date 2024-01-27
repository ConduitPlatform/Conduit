import { ProviderConfig } from './index.js';

export interface AppleProviderConfig extends ProviderConfig {
  privateKey: string;
  teamId: string;
  keyId: string;
}

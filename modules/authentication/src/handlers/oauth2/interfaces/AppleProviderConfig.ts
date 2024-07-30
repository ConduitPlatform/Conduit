import { ProviderConfig } from './ProviderConfig.js';

export interface AppleProviderConfig extends ProviderConfig {
  privateKey: string;
  teamId: string;
  keyId: string;
}

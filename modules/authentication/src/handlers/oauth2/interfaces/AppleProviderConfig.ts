import { ProviderConfig } from './ProviderConfig';

export interface AppleProviderConfig extends ProviderConfig {
  privateKey: string;
  teamId: string;
  keyId: string;
}

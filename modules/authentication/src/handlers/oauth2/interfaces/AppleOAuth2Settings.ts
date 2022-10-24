import { OAuth2Settings } from './OAuth2Settings';
import { AppleProviderConfig } from './AppleProviderConfig';

export class AppleOAuth2Settings extends OAuth2Settings {
  privateKey: string;
  teamId: string;
  keyId: string;

  constructor(
    config: AppleProviderConfig,
    parameters: {
      accessTokenMethod: string;
      grantType: string;
      authorizeUrl: string;
      tokenUrl: string;
      responseType: string;
      responseMode: string;
    },
  ) {
    super(config, parameters);
    this.privateKey = config.privateKey;
    this.teamId = config.teamId;
    this.keyId = config.keyId;
  }
}

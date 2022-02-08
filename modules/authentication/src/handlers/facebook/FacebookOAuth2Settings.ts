import { OAuth2Settings } from '../interfaces/OAuth2Settings';

export interface FacebookOAuth2Settings extends OAuth2Settings {
  appId: string;
  appSecret: string;
  state: string;
}
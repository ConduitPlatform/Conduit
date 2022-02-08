import { OAuth2Settings } from '../interfaces/OAuth2Settings';

export interface TwitchOAuth2Settings extends OAuth2Settings {
  grant_type: string;
}
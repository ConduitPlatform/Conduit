import { OAuth2Settings } from '../interfaces/OAuth2Settings';

export interface GoogleOAuth2 extends OAuth2Settings {
  include_granted_scopes: boolean;

}
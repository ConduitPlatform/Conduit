import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export interface GoogleSettings extends OAuth2Settings {
  include_granted_scopes: boolean;
}

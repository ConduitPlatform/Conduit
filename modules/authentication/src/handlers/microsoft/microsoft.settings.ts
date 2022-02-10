import { OAuth2Settings } from '../AuthenticationProviders/interfaces/OAuth2Settings';

export interface  MicrosoftSettings extends OAuth2Settings {
  response_mode: string;
}
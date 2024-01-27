import { AuthParams } from './index.js';

export interface OAuthRequest {
  headers: { [key: string]: string | number | boolean };
  method: 'GET' | 'POST';
  params?: AuthParams;
  url: string;
  data?: any;
}

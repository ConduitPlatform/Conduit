import { AuthParams } from './AuthParams';

export interface OAuthRequest {
  headers: { [key: string]: string | number | boolean | Date };
  method: 'GET' | 'POST';
  params?: AuthParams;
  url: string;
  data?: any;
}

import { AuthParams } from '../interfaces/AuthParams';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';

export function makeRequest(data: AuthParams, settings: OAuth2Settings) {
  const requestData: string = Object.keys(data)
    .map(k => {
      return k + '=' + data[k as keyof AuthParams];
    })
    .join('&');

  return {
    method: settings.accessTokenMethod,
    url: settings.tokenUrl,
    data: requestData,
    headers: {
      Accept: 'application/json',
    },
  };
}

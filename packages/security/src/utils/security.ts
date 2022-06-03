import { Request } from 'express';
import { PlatformTypesEnum } from '@conduitplatform/commons';
import * as bcrypt from 'bcrypt';

export async function validateClient(
  req: Request,
  client: {
    platform: string;
    domain: string;
    clientSecret: string;
  },
  fromRedis: boolean,
) {
  let match;
  if (client.platform === PlatformTypesEnum.WEB && client.domain) {
    if (client.domain === '*') return true;
    const isRegex = client.domain.includes('*');
    const sendDomain = req.get('origin') ?? req.hostname;
    if (isRegex) {
      const [_, regex] = client.domain.split('*.');
      match = sendDomain.endsWith(regex); // check if the regex matches with the hostname
    } else {
      match = client.domain === sendDomain;
    }
    return match;
  }
  let clientsecret = req.headers.clientsecret;
  if (fromRedis) {
    return clientsecret === client.clientSecret;
  }
  return await bcrypt.compare(clientsecret, client.clientSecret);
}

import { Request } from 'express';
import { PlatformTypesEnum } from '@conduitplatform/commons';
import * as bcrypt from 'bcrypt';

export async function validateClient(
  req: Request,
  clientsecret: string,
  client: {
    platform: string;
    domain: string;
    clientSecret: string;
  },
  fromRedis: boolean,
) {
  let match;
  if (fromRedis) {
    return clientsecret === client.clientSecret;
  }
  if (client.platform === PlatformTypesEnum.WEB && client.domain) {
    const isRegex = client.domain.includes('*');
    const sendDomain = req.get('origin') ?? req.hostname;
    if (isRegex) {
      match = (client.domain as any).test(sendDomain);  // check if the regex matches with the hostname
    } else {
      match = (client.domain === sendDomain);
    }
    return match;
  }
  return await bcrypt.compare(clientsecret, client.clientSecret);
}

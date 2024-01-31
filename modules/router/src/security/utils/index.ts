import { Request } from 'express';
import bcrypt from 'bcrypt';
import { PlatformTypesEnum } from '@conduitplatform/grpc-sdk';

export async function validateClient(
  req: Request,
  client: {
    platform: string;
    domain?: string;
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
  const clientsecret: string = req.headers.clientsecret as string;
  if (fromRedis) {
    return clientsecret === client.clientSecret;
  }
  return await bcrypt.compare(clientsecret, client.clientSecret);
}

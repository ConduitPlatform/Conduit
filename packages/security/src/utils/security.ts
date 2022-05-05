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
  let matchDomain,matchSecret;
  if (fromRedis) {
    matchSecret = (clientsecret === client.clientSecret)
  }
  else {
    matchSecret  = await bcrypt.compare(clientsecret, client.clientSecret);
  }
  if (client.platform === PlatformTypesEnum.WEB) {
    if (client.domain) {
      const isRegex = client.domain.includes('*');
      const sendDomain = req.get('origin') ?? req.hostname;
      if (isRegex) {
        matchDomain = (client.domain as any).test(sendDomain);  // check if the regex matches with the hostname
      } else {
        matchDomain = (client.domain === sendDomain);
      }
      return matchDomain;
    }
  }
  return matchSecret;
}

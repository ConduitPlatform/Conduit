import { Request } from 'express';
import { PlatformTypesEnum } from '@conduitplatform/commons';

export function validatePlatform(req: Request, platform: string, domain: string) {
  let match = true;
  if (platform === PlatformTypesEnum.WEB && domain) {
    const isRegex = domain.includes('*');
    const sendDomain = req.get('origin') ?? req.hostname;
    if (isRegex) {
      match = (domain as any).test(sendDomain);  // check if the regex matches with the hostname
    } else {
      match = (domain === sendDomain);
    }
  }
  return match;
}

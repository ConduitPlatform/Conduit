import { Config as ConfigSchema } from '../config';
import crypto from 'crypto';
import { isNil } from 'lodash';

export async function generateConfigDefaults(
  config: ConfigSchema,
): Promise<ConfigSchema> {
  const tokenSecretConfig = config.auth.tokenSecret;
  const hostUrlConfig = config.hostUrl;
  if (tokenSecretConfig === '' || isNil(tokenSecretConfig)) {
    config.auth.tokenSecret = crypto.randomBytes(64).toString('base64');
  }
  if (hostUrlConfig === '' || isNil(hostUrlConfig)) {
    const portValue = (process.env['ADMIN_HTTP_PORT'] || process.env['PORT']) ?? '3030'; // <=v13 compat (PORT)
    config.hostUrl = `http://localhost:${portValue}`;
  }
  return config;
}

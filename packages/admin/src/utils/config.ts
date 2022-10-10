import { Config as ConfigSchema } from '../config';
import crypto from 'crypto';
import { isNil } from 'lodash';

export async function generateConfigDefaults(config: ConfigSchema) {
  const tokenSecretConfig = config.auth.tokenSecret;
  if (tokenSecretConfig === '' || isNil(tokenSecretConfig)) {
    config.auth.tokenSecret = crypto.randomBytes(64).toString('base64');
  }
  if (config.hostUrl === '') {
    config.hostUrl =
      process.env.__DEFAULT_HOST_URL ??
      `http://localhost:${process.env['ADMIN_HTTP_PORT'] ?? '3030'}`;
  }
}

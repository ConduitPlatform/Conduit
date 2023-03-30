import fs from 'fs-extra';

export function getJsonEnv(envName: string, envValue?: string) {
  envValue ??= process.env[envName];
  if (!envValue) return undefined;
  let jsonConfig: object;
  if (envValue.startsWith('{')) {
    try {
      jsonConfig = JSON.parse(envValue);
    } catch (e) {
      throw new Error(`Invalid JSON in ${envName}`);
    }
  } else {
    try {
      jsonConfig = JSON.parse(fs.readFileSync(envValue).toString());
    } catch (e) {
      throw new Error('Invalid JSON in REDIS_CONFIG');
    }
  }
  return jsonConfig;
}

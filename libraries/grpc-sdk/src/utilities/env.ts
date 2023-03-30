import fs from 'fs-extra';

export function getJsonEnv<JsonFormat extends object>(
  envName: string,
  envValue?: string,
  handleString?: (value: string) => object,
): JsonFormat | undefined {
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
      if (handleString) {
        jsonConfig = handleString(envValue);
      } else {
        throw new Error(`Invalid JSON in ${envName}`);
      }
    }
  }
  return jsonConfig as JsonFormat;
}

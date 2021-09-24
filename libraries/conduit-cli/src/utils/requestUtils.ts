import * as fs from 'fs-extra';
import * as path from 'path';
import Command from '@oclif/command';
import { Requests } from '../http/http';

export async function recoverCredentials(command: Command) {
  const apiConfig = await fs.readJSON(path.join(command.config.configDir, 'config.json'));
  const userConfig = await fs.readJSON(path.join(command.config.cacheDir, 'token.json'));
  let requestClient = new Requests(apiConfig.url, apiConfig.masterKey);
  if (userConfig.token) {
    requestClient.setToken(userConfig.token);
  }
  return requestClient;
}

export async function recoverUrl(command: Command) {
  const apiConfig = await fs.readJSON(path.join(command.config.configDir, 'config.json'));
  return { url: apiConfig.url, masterKey: apiConfig.masterKey };
}

export async function storeCredentials(
  command: Command,
  environment: { url: string; masterKey: string },
  token: string
) {
  await fs.ensureFile(path.join(command.config.configDir, 'config.json'));
  await fs.ensureFile(path.join(command.config.cacheDir, 'token.json'));
  await fs.writeJSON(path.join(command.config.configDir, 'config.json'), environment);
  await fs.writeJSON(path.join(command.config.cacheDir, 'token.json'), { token });
}

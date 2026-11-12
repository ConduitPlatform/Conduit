import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';
import { AppleOAuthClientConfig } from '../interfaces/AppleProviderConfig.js';

/** Keeps the specific reason client-visible under one stable code. */
function invalid(message: string): ModuleError {
  return new ModuleError({ ...errors.APPLE_CLIENT_CONFIG_INVALID, message });
}

export function validateAppleClients(clients: AppleOAuthClientConfig[]): void {
  const ids = new Set<string>();
  for (const client of clients) {
    const trimmedId = client.id?.trim() ?? '';
    if (!trimmedId) {
      throw invalid('Apple OAuth client id cannot be empty');
    }
    if (ids.has(trimmedId)) {
      throw invalid(`Duplicate Apple OAuth client id: ${trimmedId}`);
    }
    ids.add(trimmedId);

    const trimmedClientId = client.clientId?.trim() ?? '';
    if (!trimmedClientId) {
      throw invalid(`Apple OAuth client '${trimmedId}' is missing clientId`);
    }

    const hasPrivateKey = client.privateKey !== undefined && client.privateKey !== '';
    const hasTeamId = client.teamId !== undefined && client.teamId !== '';
    const hasKeyId = client.keyId !== undefined && client.keyId !== '';
    const setCount = [hasPrivateKey, hasTeamId, hasKeyId].filter(Boolean).length;

    if (setCount !== 0 && setCount !== 3) {
      throw invalid(
        `Apple OAuth client '${trimmedId}' has mixed credentials. Either omit all three (privateKey, teamId, keyId) to inherit from top-level Apple, or provide all three for a second team`,
      );
    }
  }
}

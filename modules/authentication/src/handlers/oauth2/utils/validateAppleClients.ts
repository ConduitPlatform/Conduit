import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AppleOAuthClientConfig } from '../interfaces/AppleProviderConfig.js';

export function validateAppleClients(clients: AppleOAuthClientConfig[]): void {
  const ids = new Set<string>();
  for (const client of clients) {
    const trimmedId = client.id?.trim() ?? '';
    if (!trimmedId) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Apple OAuth client id cannot be empty',
      );
    }
    if (ids.has(trimmedId)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Duplicate Apple OAuth client id: ${trimmedId}`,
      );
    }
    ids.add(trimmedId);

    const trimmedClientId = client.clientId?.trim() ?? '';
    if (!trimmedClientId) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Apple OAuth client '${trimmedId}' is missing clientId`,
      );
    }

    const hasPrivateKey = client.privateKey !== undefined && client.privateKey !== '';
    const hasTeamId = client.teamId !== undefined && client.teamId !== '';
    const hasKeyId = client.keyId !== undefined && client.keyId !== '';
    const setCount = [hasPrivateKey, hasTeamId, hasKeyId].filter(Boolean).length;

    if (setCount !== 0 && setCount !== 3) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Apple OAuth client '${trimmedId}' has mixed credentials. Either omit all three (privateKey, teamId, keyId) to inherit from top-level Apple, or provide all three for a second team`,
      );
    }
  }
}

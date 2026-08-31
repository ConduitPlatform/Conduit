import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AppleOAuthClientConfig } from '../interfaces/AppleProviderConfig.js';

export function validateAppleClients(clients: AppleOAuthClientConfig[]): void {
  const ids = new Set<string>();
  for (const client of clients) {
    if (!client.id || client.id.trim() === '') {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Apple OAuth client id cannot be empty',
      );
    }
    if (ids.has(client.id)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Duplicate Apple OAuth client id: ${client.id}`,
      );
    }
    ids.add(client.id);

    if (!client.clientId) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Apple OAuth client '${client.id}' is missing clientId`,
      );
    }

    const hasPrivateKey = client.privateKey !== undefined && client.privateKey !== '';
    const hasTeamId = client.teamId !== undefined && client.teamId !== '';
    const hasKeyId = client.keyId !== undefined && client.keyId !== '';
    const setCount = [hasPrivateKey, hasTeamId, hasKeyId].filter(Boolean).length;

    if (setCount !== 0 && setCount !== 3) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Apple OAuth client '${client.id}' has mixed credentials. Either omit all three (privateKey, teamId, keyId) to inherit from top-level Apple, or provide all three for a second team`,
      );
    }
  }
}

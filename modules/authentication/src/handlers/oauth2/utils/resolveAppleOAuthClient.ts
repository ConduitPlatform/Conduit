import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '@conduitplatform/module-tools';
import {
  AppleOAuthClientConfig,
  ResolvedAppleOAuthClient,
} from '../interfaces/AppleProviderConfig.js';

function findAppleClient(
  clients: AppleOAuthClientConfig[] | undefined,
  oauthClientId: string,
): AppleOAuthClientConfig {
  const client = (clients ?? []).find(entry => entry.id === oauthClientId);
  if (!client) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Unknown Apple OAuth client id: ${oauthClientId}`,
    );
  }
  return client;
}

function assertRequiredCredential(
  value: string | undefined,
  oauthClientId: string,
  field: string,
): asserts value is string {
  if (!value) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Apple OAuth client '${oauthClientId}' is missing ${field}`,
    );
  }
}

function isEmptyString(value: string | undefined): boolean {
  return value === '';
}

export function resolveAppleOAuthClient(
  oauthClientId?: string,
): ResolvedAppleOAuthClient {
  const providerConfig = ConfigController.getInstance().config.apple;
  if (!oauthClientId) {
    return {
      clientId: providerConfig.clientId,
      redirect_uri: providerConfig.redirect_uri,
      privateKey: providerConfig.privateKey,
      teamId: providerConfig.teamId,
      keyId: providerConfig.keyId,
    };
  }

  const client = findAppleClient(providerConfig.clients, oauthClientId);

  if (!client.id || client.id.trim() === '') {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Apple OAuth client id cannot be empty');
  }

  assertRequiredCredential(client.clientId, oauthClientId, 'clientId');

  const hasPrivateKey =
    client.privateKey !== undefined && !isEmptyString(client.privateKey);
  const hasTeamId = client.teamId !== undefined && !isEmptyString(client.teamId);
  const hasKeyId = client.keyId !== undefined && !isEmptyString(client.keyId);

  const setCount = [hasPrivateKey, hasTeamId, hasKeyId].filter(Boolean).length;

  if (setCount === 0) {
    return {
      clientId: client.clientId,
      redirect_uri:
        client.redirect_uri && client.redirect_uri !== ''
          ? client.redirect_uri
          : providerConfig.redirect_uri,
      privateKey: providerConfig.privateKey,
      teamId: providerConfig.teamId,
      keyId: providerConfig.keyId,
    };
  } else if (setCount === 3) {
    return {
      clientId: client.clientId,
      redirect_uri:
        client.redirect_uri && client.redirect_uri !== ''
          ? client.redirect_uri
          : providerConfig.redirect_uri,
      privateKey: client.privateKey!,
      teamId: client.teamId!,
      keyId: client.keyId!,
    };
  } else {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Apple OAuth client '${oauthClientId}' has mixed credentials. Either omit all three (privateKey, teamId, keyId) to inherit from top-level Apple, or provide all three for a second team`,
    );
  }
}

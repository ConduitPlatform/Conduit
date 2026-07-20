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
  assertRequiredCredential(client.clientId, oauthClientId, 'clientId');
  assertRequiredCredential(client.privateKey, oauthClientId, 'privateKey');
  assertRequiredCredential(client.teamId, oauthClientId, 'teamId');
  assertRequiredCredential(client.keyId, oauthClientId, 'keyId');

  return {
    clientId: client.clientId,
    redirect_uri: client.redirect_uri ?? providerConfig.redirect_uri,
    privateKey: client.privateKey,
    teamId: client.teamId,
    keyId: client.keyId,
  };
}

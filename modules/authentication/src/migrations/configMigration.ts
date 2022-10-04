import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';

export async function configMigration(grpcSdk: ConduitGrpcSdk) {
  const authConfig = ((await grpcSdk.databaseProvider!.findOne('Config', {})) as any)
    ?.moduleConfigs?.authentication;

  if (isNil(authConfig) || isNil(authConfig.generateRefreshToken)) {
    return;
  }

  Object.assign(authConfig, { twoFa: { methods: { sms: false, authenticator: true } } });

  Object.assign(authConfig, {
    refreshTokens: { enabled: authConfig.generateRefreshToken },
  });
  Object.assign(authConfig, {
    refreshTokens: { expiryPeriod: authConfig.refreshTokenInvalidationPeriod },
  });
  Object.assign(authConfig, {
    accessTokens: { expiryPeriod: authConfig.tokenInvalidationPeriod },
  });
  Object.assign(authConfig, { accessTokens: { jwtSecret: authConfig.jwtSecret } });
  Object.assign(authConfig, {
    accessTokens: { setCookie: authConfig.setCookies.enabled },
  });
  Object.assign(authConfig, {
    accessTokens: { cookieOptions: authConfig.setCookies.options },
  });
  Object.assign(authConfig, {
    refreshTokens: { setCookie: authConfig.setCookies.enabled },
  });
  Object.assign(authConfig, {
    refreshTokens: { cookieOptions: authConfig.setCookies.options },
  });

  delete authConfig.twofa;
  delete authConfig.refreshTokenInvalidationPeriod;
  delete authConfig.tokenInvalidationPeriod;
  delete authConfig.jwtSecret;
  delete authConfig.generateRefreshToken;
  delete authConfig.setCookies;
  delete authConfig.rateLimit;

  return authConfig;
}

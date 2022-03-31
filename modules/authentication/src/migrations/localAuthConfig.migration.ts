import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

const legacyKeys = [
  'sendVerificationEmail',
  'verificationRequired',
  'verification_redirect_uri',
  'identifier',
];

function configIsOutdated(authConfig: any) {
  return Object.keys(authConfig.local).some(key => legacyKeys.includes(key));
}

export async function migrateLocalAuthConfig(grpcSdk: ConduitGrpcSdk) {
  await grpcSdk.config.get('authentication')
    .then(async (authConfig: any) => {
      if (configIsOutdated(authConfig)) {
        authConfig.local.verification = {
          required: authConfig.local.verificationRequired,
          send_email: authConfig.local.sendVerificationEmail,
          redirect_uri: authConfig.local.verification_redirect_uri,
        }
        legacyKeys.forEach(key => { delete authConfig.local[key]; });
        await grpcSdk.config.updateConfig(authConfig, 'authentication');
      }
    })
    .catch(err => {
      console.log('nothing to update, no config')
    });
}

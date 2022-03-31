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
  const authConfig = await grpcSdk.config.get('authentication')
    .catch(err => {
      console.error(err.message);
    });
  if (authConfig && configIsOutdated(authConfig)) {
    authConfig.local.verification = {
      required: authConfig.local.verificationRequired,
      send_email: authConfig.local.sendVerificationEmail,
      redirect_uri: authConfig.local.verification_redirect_uri,
    }
    legacyKeys.forEach(key => { delete authConfig.local[key]; });
    await grpcSdk.config.updateConfig(authConfig, 'authentication');
  }
}

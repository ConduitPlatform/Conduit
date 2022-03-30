import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { Config } from '../models';

const legacyKeys = [
  'sendVerificationEmail',
  'verificationRequired',
  'verification_redirect_uri',
];

function configIsOutdated(authConfig: any) {
  return Object.keys(authConfig.local).some(key => legacyKeys.includes(key));
}

export async function migrateAuthVerificationConfig(grpcSdk: ConduitGrpcSdk) {
  const config = await Config.getInstance().findOne({});
  if (config) {
    const authConfig = config.moduleConfigs ? config.moduleConfigs.authentication : undefined;
    if (authConfig && configIsOutdated(authConfig)) {
      authConfig.local.verification = {
        required: authConfig.local.verificationRequired,
        sendEmail: authConfig.local.sendVerificationEmail,
        format: authConfig.local.verification_redirect_uri,
      }
      legacyKeys.forEach(key => { delete authConfig.local[key]; });
      config.moduleConfigs.authentication = authConfig;
      await Config.getInstance()
        .findByIdAndUpdate(config._id, config)
        .catch((err) => { console.error(err.message); });
    }
  } else {
    console.error('Conduit configuration not created yet');
  }
}

import db from '../mongoConnection.js';
import _ from 'lodash';



const migrateV11_V12_migrateLocalAuthConfig = async () => {

  const documents = db.collection('configs');
  const authConfig = await documents.findOne({ 'moduleConfigs.authentication': { $exists: true } });
  if (!_.isNil(authConfig)) {
    if (authConfig.moduleConfigs.authentication.local['verificationRequired']) {
      authConfig.moduleConfigs.authentication.local.verification = {
        required: authConfig.moduleConfigs.authentication.local['verificationRequired'],
        send_email: authConfig.moduleConfigs.authentication.local['sendVerificationEmail'],
        redirect_uri: authConfig.moduleConfigs.authentication.local['verification_redirect_uri'],
      };
      delete authConfig.moduleConfigs.authentication.local['verificationRequired'];
      delete authConfig.moduleConfigs.authentication.local['sendVerificationEmail'];
      delete authConfig.moduleConfigs.authentication.local['verification_redirect_uri'];
      await documents.replaceOne({ _id: authConfig._id }, authConfig);
    }
  }
};


const migrateV11_V12_cmsOwners = async () => {
  const documents = db.collection('_declaredschemas');
  const schemas = await documents.find({ ownerModule: 'cms' }).toArray();
  if (schemas.filter((schema) => schema.name !== 'SchemaDefinitions').length === 0)
    return;
  if (schemas.length > 0) {
    await documents.updateMany({ ownerModule: 'cms' }, { $set: { ownerModule: 'database' } });
  }
};

const migrateV11_V12_customEndpoints = async () => {
  const documents = db.collection('customendpoints');
  const customEndpoints = await documents.find().toArray();
  for (const customEndpoint of customEndpoints) {
    if (!_.isNil(customEndpoint.queries) && _.isNil(customEndpoint.query)) {
      await documents.updateOne({ _id: customEndpoint._id }, { $set: { query: customEndpoint.queries } });
    }
  }
};


export async function migrateV11_V12() {
  await migrateV11_V12_migrateLocalAuthConfig();
  await migrateV11_V12_cmsOwners();
  await migrateV11_V12_customEndpoints();

};

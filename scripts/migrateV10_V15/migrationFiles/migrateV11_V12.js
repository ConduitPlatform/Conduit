const db = require('../mongoConnection');
const { isNil, merge } = require('lodash');




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
  const documents = db.collection('_declaredschemas');
  const declaredSchemas = await documents.find({ 'modelOptions.conduit': { $exists: false } }).toArray();
  for (const declaredSchema of declaredSchemas) {
    let newModelOptions = { conduit: {} };
    try {
      newModelOptions = { ...newModelOptions, ...JSON.parse((declaredSchema.modelOptions)) };
    } catch {
      newModelOptions = { ...newModelOptions, ...declaredSchema.modelOptions };
    }
    await documents.updateOne({ _id: declaredSchema._id }, { modelOptions: newModelOptions }).catch((err) => {
      console.log(err);
    });
  }
};

const migrateV11_V12_modelOptions = async () => {
  const documents = db.collection('_declaredschemas');
  const cmsSchemas = await documents.find({
    $or: [
      { 'modelOptions.conduit.cms.crudOperations': true },
      { 'modelOptions.conduit.cms.crudOperations': false },
    ],
  }).toArray();
  for (const schema of cmsSchemas) {
    const { crudOperations, authentication, enabled } = schema.modelOptions.conduit.cms;
    const cms = {
      enabled: enabled,
      crudOperations: {
        create: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        read: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        update: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        delete: {
          enabled: crudOperations,
          authenticated: authentication,
        },
      },
    };
    const id = schema._id.toString();
    await documents.updateMany({ _id : id}, {
      $set: {
        modelOptions: {
          conduit: { cms },
        },
      },
    });
  }
};

const migrateV11_V12_schemaDefinitions = async () => {
  const documents = db.collection('_declaredschemas');
  const schemas = await documents.find({name: 'SchemaDefinitions'}).toArray();
  if (schemas.filter((schema) => schema.name === 'SchemaDefinitions').length === 0)
    return;

  const SchemaDefinitions = db.collection('schemadefinitions');
  const schemaDefinitions = await SchemaDefinitions.find().toArray();

  // Migrate SchemaDefinitions to DeclaredSchemas
  if (!isNil(schemaDefinitions) && schemaDefinitions.length !== 0) {
    for (const schema of schemaDefinitions) {
      const declaredSchema = await db.collection('_declaredschemas')
        .findOne({ name: schema.name });
      let modelOptions = {
        conduit: {
          cms: {
            authentication: schema.authentication,
            crudOperations: schema.crudOperations,
            enabled: schema.enabled,
          },
        },
      };
      try {
        modelOptions = merge(
          JSON.parse(schema.modelOptions),
          modelOptions,
        );
      } catch {
      }
      if ((declaredSchema) && (
        !declaredSchema.modelOptions ||
        !declaredSchema.modelOptions.conduit ||
        !('cms' in declaredSchema.modelOptions.conduit)
      )) {
        // DeclaredSchema exists, missing metadata
        modelOptions =
          declaredSchema.modelOptions // possibly undefined
            ? merge(declaredSchema.modelOptions, modelOptions)
            : modelOptions;
      }

      // create new schema
      await documents.insertOne({name: schema.name, fields: schema.fields, modelOptions: modelOptions});
    }

    // delete schemaDefinitions collection and documents
    await SchemaDefinitions.drop();
  }
};

const migrateV11_V12_Authentication = async () => {

  const documents = db.collection('configs');
  const authConfig = await documents.findOne({"moduleConfigs.authentication": {$exists: true}});
  if(!isNil(authConfig)) {
    if (authConfig.moduleConfigs.authentication.local['verificationRequired']) {
      authConfig.moduleConfigs.authentication.local.verification = {
        required: authConfig.moduleConfigs.authentication.local['verificationRequired'],
        send_email: authConfig.moduleConfigs.authentication.local['sendVerificationEmail'],
        redirect_uri: authConfig.moduleConfigs.authentication.local['verification_redirect_uri'],
      };
      delete authConfig.moduleConfigs.authentication.local['verificationRequired'];
      delete authConfig.moduleConfigs.authentication.local['sendVerificationEmail'];
      delete authConfig.moduleConfigs.authentication.local['verification_redirect_uri'];
      await documents.replaceOne({ _id:  authConfig._id }, authConfig);
    }
  }
};

const migrateV11_V12 = async () => {
  await migrateV11_V12_Authentication();
  await migrateV11_V12_cmsOwners();
  await migrateV11_V12_customEndpoints();
  await migrateV11_V12_modelOptions();
  await migrateV11_V12_schemaDefinitions();
}

module.exports = migrateV11_V12;
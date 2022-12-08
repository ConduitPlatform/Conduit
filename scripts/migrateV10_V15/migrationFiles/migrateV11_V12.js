const db = require('../mongoConnection');
const { isNil, merge } = require('lodash');




const migrateV12_V15_cmsOwners = async () => {
  const documents = db.collection('_declaredschemas');
  const schemas = await documents.find({ ownerModule: 'cms' }).toArray();
  if (schemas.filter((schema) => schema.name !== 'schemadefinitions').length === 0)
    return;
  if (schemas.length > 0) {
    await documents.updateMany({ ownerModule: 'cms' }, { $set: { ownerModule: 'database' } });
  }

  const CustomEndpointSchema = db.collection('customendpoints');
  const customEndpoints = await CustomEndpointSchema.find().toArray();
  for (const customEndpoint of customEndpoints) {
    if (!isNil(customEndpoint.queries) && isNil(customEndpoint.query)) {
      customEndpoint.query = { AND: customEndpoint.queries };
      await CustomEndpointSchema.findOneAndUpdate(customEndpoint._id, customEndpoint);
    }
  }
};

const migrateV12_V15_customEndpoints = async () => {
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

const migrateV12_V15_modelOptions = async () => {
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

const migrateV12_V15_schemaDefinitions = async () => {
  const documents = db.collection('_declaredschemas');
  const schemas = await documents.find().toArray();
  if (schemas.filter((schema) => schema.name === 'schemadefinitions').length === 0)
    return;

  const SchemaDefinitions = db.collection('schemadefinitions');
  const schemaDefinitions = await SchemaDefinitions.find().toArray();

  // Migrate SchemaDefinitions to DeclaredSchemas
  if (!isNil(schemaDefinitions)) {
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
      const newSchema = (schema.name, schema.fields, modelOptions);
      // create new schema
      await documents.insertOne(newSchema);
    }

    // Delete SchemaDefinitions
    // await adapter.deleteSchema('SchemaDefinitions', true, 'database');
    await SchemaDefinitions.drop();
  }
};

const migrateV12_V15 = async () => {
  const documents = db.collection('configs');
  const authConfig = await documents.findOne({"moduleConfigs.authentication": {$exists: true}});
  if (authConfig.local['verificationRequired']) {
    authConfig.local.verification = {
      required: authConfig.local['verificationRequired'],
      send_email: authConfig.local['sendVerificationEmail'],
      redirect_uri: authConfig.local['verification_redirect_uri'],
    };
    delete authConfig.local['verificationRequired'];
    delete authConfig.local['sendVerificationEmail'];
    delete authConfig.local['verification_redirect_uri'];
    await documents.findOneAndUpdate(authConfig._id, authConfig);
  }
};

const migrateV11_V12 = async () => {
  await migrateV12_V15_schemaDefinitions();
  await migrateV12_V15_modelOptions();
  await migrateV12_V15_customEndpoints();
  await migrateV12_V15_cmsOwners();
  await migrateV12_V15();
}

module.exports = migrateV11_V12;
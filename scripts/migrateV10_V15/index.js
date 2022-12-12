const migrateOwnerModule = require('../migrateV10_V15/migrationFiles/schemaOwnerModule');
const migrateSchemaCollectionName = require('../migrateV10_V15/migrationFiles/schemaCollectionName');
const migrateV10_V11 = require('../migrateV10_V15/migrationFiles/migrateV10_V11');
const migrateV11_V12 = require('../migrateV10_V15/migrationFiles/migrateV11_V12');
const migrateV12_V13 = require('../migrateV10_V15/migrationFiles/migrateV12_V13');
const migrateV13_V14 = require('../migrateV10_V15/migrationFiles/migrateV13_V14');
const migrateV14_V15 = require('../migrateV10_V15/migrationFiles/migrateV14_V15');
const migrateRemoveKakaoFromUser = require('../migrateV10_V15/migrationFiles/removeKakaoFromUser');
const { MongoConnection } = require('./mongoConnection');

const migrate = async () => {
  try {
    await MongoConnection;
    await migrateV10_V15();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (e) {
    console.log(e);
  }
};
const migrateV10_V15 = async () => {
  await migrateOwnerModule();
  await migrateSchemaCollectionName();
  await migrateV10_V11();
  await migrateV11_V12();
  await migrateV12_V13();
  await migrateV13_V14();
  await migrateV14_V15();
  await migrateRemoveKakaoFromUser();
};

migrate().then(r => console.log(r)).catch(e => console.log(e));

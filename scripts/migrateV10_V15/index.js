const { authentication } = require('./migrationFiles/authenticationMigrations');
const { storageModule } = require('./migrationFiles/storageMigrations');
const { customEndpoints } = require('./migrationFiles/database/customEndpointsMigrations');
const { databaseModule } = require('./migrationFiles/database/databaseMigrations');
const { MongoConnection } = require('./mongoConnection');

const migrate = async () => {
  await MongoConnection;
  await migrateV10_V15();
};
const migrateV10_V15 = async () => {
  await authentication;
  await storageModule;
  await customEndpoints;
  await databaseModule;
};

migrate().catch(e => console.log(e));
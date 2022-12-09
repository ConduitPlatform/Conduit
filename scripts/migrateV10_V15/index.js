const  migrateV10_V11  = require('../migrateV10_V15/migrationFiles/migrateV10_V11');
const  migrateV11_V12  = require('../migrateV10_V15/migrationFiles/migrateV11_V12');
const  migrateV13_V14  = require('../migrateV10_V15/migrationFiles/migrateV13_V14');
const  migrateV14_V15  = require('../migrateV10_V15/migrationFiles/migrateV14_V15');
const { MongoConnection } = require('./mongoConnection');

const migrate = async () => {
  try {
    await MongoConnection;
    await migrateV10_V15();
    console.log('Migration completed successfully');
    process.exit(0);
  }
  catch (e) {
    console.log(e);
  }
};
const migrateV10_V15 = async () => {
  await migrateV10_V11();
  await migrateV11_V12();
  await migrateV13_V14();
  await migrateV14_V15();
};

migrate().then(r => console.log(r)).catch(e => console.log(e));

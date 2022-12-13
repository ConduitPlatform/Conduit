import { migrateOwnerModule } from './migrationFiles/schemaOwnerModule.js';
import { migrateSchemaCollectionName } from './migrationFiles/schemaCollectionName.js';
import { migrateV10_V11 } from './migrationFiles/migrateV10_V11.js';
import { migrateV11_V12 } from './migrationFiles/migrateV11_V12.js';
import { migrateV12_V13 } from './migrationFiles/migrateV12_V13.js';
import { migrateV13_V14 } from './migrationFiles/migrateV13_V14.js';
import { migrateV14_V15 } from './migrationFiles/migrateV14_V15.js';
import { migrateRemoveKakaoFromUser } from './migrationFiles/removeKakaoFromUser.js';
import * as MongoClient from './mongoConnection.js';
const migrate = async () => {
  try {
    await MongoClient;
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

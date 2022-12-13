import {
  migrateRemoveKakaoFromUser,
  migrateOwnerModule,
  migrateSchemaCollectionName,
  migrateV10_V11,
  migrateV11_V12,
  migrateV12_V13,
  migrateV13_V14,
  migrateV14_V15,
} from './migrationFiles/index.js';
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

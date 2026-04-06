import path from 'node:path';
import { fileURLToPath } from 'node:url';
import DatabaseModule from './Database.js';

const dbType = process.env.DB_TYPE ?? 'mongodb';
const dbUri = process.env.DB_CONN_URI ?? 'mongodb://localhost:27017';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const database = new DatabaseModule(dbType, dbUri, peerManifestRoot);
database.start();

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import StorageModule from './Storage.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const storage = new StorageModule(peerManifestRoot);
storage.start();

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Authentication from './Authentication.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const authentication = new Authentication(peerManifestRoot);
authentication.start();

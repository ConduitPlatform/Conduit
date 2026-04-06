import path from 'node:path';
import { fileURLToPath } from 'node:url';
import FunctionsModule from './Functions.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const functions = new FunctionsModule(peerManifestRoot);
functions.start();

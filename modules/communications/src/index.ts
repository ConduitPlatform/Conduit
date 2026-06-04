import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Communications from './Communications.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const communications = new Communications(peerManifestRoot);
communications.start();

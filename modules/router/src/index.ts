import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ConduitDefaultRouter from './Router.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const router = new ConduitDefaultRouter(peerManifestRoot);
router.start();

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AuthorizationModule from './Authorization.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const authorization = new AuthorizationModule(peerManifestRoot);
authorization.start();

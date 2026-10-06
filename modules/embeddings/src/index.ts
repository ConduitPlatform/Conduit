import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddingsModule from './Embeddings.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const embeddings = new EmbeddingsModule(peerManifestRoot);
embeddings.start();

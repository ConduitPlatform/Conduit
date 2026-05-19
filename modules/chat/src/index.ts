import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ChatModule from './Chat.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chat = new ChatModule(peerManifestRoot);
chat.start();

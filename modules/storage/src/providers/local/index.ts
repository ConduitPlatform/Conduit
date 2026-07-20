import { IStorageProvider, StorageConfig, UrlOptions } from '../../interfaces/index.js';
import {
  access,
  accessSync,
  chmod,
  constants,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdir,
  mkdirSync,
  readFile,
  rmSync,
  unlink,
  writeFile,
} from 'fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { dirname, extname, resolve, sep } from 'path';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { constructDispositionHeader } from '../../utils/index.js';

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export class LocalStorage implements IStorageProvider {
  _rootStoragePath: string;
  _storagePath: string;
  _activeContainer: string;
  private _httpPort: number;
  private _httpBaseUrl: string;
  private _httpServer: Server | null = null;

  constructor(options?: StorageConfig) {
    this._activeContainer = '';
    this._rootStoragePath = options && options.local ? options.local.storagePath : '';
    this._storagePath = this._rootStoragePath;
    this._httpPort = options?.local?.httpPort ?? 3100;
    this._httpBaseUrl =
      options?.local?.httpBaseUrl ?? `http://localhost:${this._httpPort}`;
    if (this._storagePath !== '') {
      try {
        accessSync(this._storagePath, constants.R_OK | constants.W_OK);
        ConduitGrpcSdk.Logger.log('Can read/write in ' + this._storagePath);
      } catch (err) {
        ConduitGrpcSdk.Logger.log('Can not  read/write in ' + this._storagePath);
        ConduitGrpcSdk.Logger.log('Changing permissions..');
        chmod(this._storagePath, 0o600, () => {
          ConduitGrpcSdk.Logger.log('Permissions changed');
        });
      }
      this.startHttpServer();
    }
  }

  /**
   * Serves uploads/downloads for URLs returned by getUploadUrl(), getSignedUrl()
   * and getPublicUrl(). Mirrors the presigned-URL pattern used by cloud providers,
   * but reads/writes directly against the local filesystem.
   */
  private startHttpServer(): void {
    const rootPath = resolve(this._rootStoragePath);

    this._httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ms-blob-type');
      res.setHeader('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      let url: URL;
      try {
        url = new URL(req.url ?? '/', `http://localhost:${this._httpPort}`);
      } catch {
        res.writeHead(400);
        return res.end('Bad request');
      }

      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const filePath = resolve(rootPath, relativePath);

      // Path traversal protection: resolved path must stay within rootPath
      if (!relativePath || !filePath.startsWith(rootPath + sep)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }

      if (req.method === 'GET') {
        if (!existsSync(filePath)) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.setHeader('Content-Type', getMimeType(filePath));
        const download = url.searchParams.get('download') === 'true';
        const fileNameParam = url.searchParams.get('fileName') ?? undefined;
        const baseName = relativePath.split('/').pop() ?? relativePath;
        const disposition = constructDispositionHeader(baseName, {
          download,
          fileName: fileNameParam,
        });
        if (disposition) {
          res.setHeader('Content-Disposition', disposition);
        }
        createReadStream(filePath).pipe(res);
      } else if (req.method === 'PUT') {
        mkdirSync(dirname(filePath), { recursive: true });
        const writeStream = createWriteStream(filePath);
        req.pipe(writeStream);
        writeStream.on('finish', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
        writeStream.on('error', err => {
          res.writeHead(500);
          res.end(err.message);
        });
      } else {
        res.writeHead(405);
        res.end('Method not allowed');
      }
    });

    this._httpServer.on('error', err => {
      ConduitGrpcSdk.Logger.error(
        new Error(`[LocalStorage] HTTP file server error: ${(err as Error).message}`),
      );
    });

    this._httpServer.listen(this._httpPort, () => {
      ConduitGrpcSdk.Logger.log(
        `[LocalStorage] HTTP file server listening on port ${this._httpPort}`,
      );
    });
  }

  async dispose(): Promise<void> {
    if (!this._httpServer) return;
    const server = this._httpServer;
    this._httpServer = null;
    await new Promise<void>(res => {
      server.close(() => res());
    });
  }

  getUploadUrl(fileName: string): Promise<string | Error> {
    return Promise.resolve(`${this._httpBaseUrl}/${this._activeContainer}/${fileName}`);
  }

  deleteContainer(name: string): Promise<boolean | Error> {
    return this.deleteFolder(name);
  }

  deleteFolder(name: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (name !== self._activeContainer) {
      path += name;
    }

    return new Promise(function (res, reject) {
      try {
        rmSync(resolve(path), { recursive: true });
        ConduitGrpcSdk.Metrics?.decrement('folders_total');
        ConduitGrpcSdk.Metrics?.decrement('containers_total');
        res(true);
      } catch (e) {
        reject(e);
      }
    });
  }

  get(fileName: string): Promise<Buffer | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    if (!existsSync(resolve(path))) {
      return new Promise(function (res, reject) {
        reject(new Error('File does not exist'));
      });
    }
    return new Promise(function (res, reject) {
      readFile(resolve(path), function (err, data) {
        if (err) reject(err);
        else res(data);
      });
    });
  }

  store(fileName: string, data: any, _isPublic?: boolean): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    return new Promise(function (res, reject) {
      writeFile(resolve(path), data, function (err) {
        if (err) reject(err);
        else {
          res(true);
        }
      });
    });
  }

  async createFolder(name: string): Promise<boolean | Error> {
    const self = this;
    return new Promise(async function (res, reject) {
      let path = self._storagePath + '/' + self._activeContainer;
      const containerExists = await self.folderExists(self._activeContainer);
      if (!containerExists) {
        mkdir(path, function (err) {
          if (err) reject(err);
        });
      }
      if (self._activeContainer !== name) {
        path = self._storagePath + '/' + self._activeContainer + '/' + name;
        mkdir(resolve(path), function (err) {
          if (err) reject(err);
          else res(true);
        });
      }
      ConduitGrpcSdk.Metrics?.increment('folders_total');
      ConduitGrpcSdk.Metrics?.increment('containers_total');
      res(true);
    });
  }

  folderExists(name: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (name !== self._activeContainer) {
      path += name;
    }
    return new Promise(function (res) {
      access(resolve(path), function (err) {
        if (err) res(false);
        else res(true);
      });
    });
  }

  delete(fileName: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';
    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    return new Promise(function (res, reject) {
      unlink(resolve(path), function (err) {
        if (err) reject(err);
        else {
          res(true);
        }
      });
    });
  }

  exists(fileName: string): Promise<boolean | Error> {
    const self = this;
    let path = self._storagePath + '/' + self._activeContainer + '/';

    if (fileName !== self._activeContainer) {
      path += fileName;
    }
    return new Promise(function (res) {
      if (!existsSync(resolve(path))) {
        res(false);
      } else {
        res(true);
      }
    });
  }

  getPublicUrl(fileName: string, _containerIsPublic?: boolean): Promise<string | Error> {
    return Promise.resolve(`${this._httpBaseUrl}/${this._activeContainer}/${fileName}`);
  }

  getSignedUrl(fileName: string, options?: UrlOptions): Promise<string | Error> {
    const params = new URLSearchParams();
    if (options?.download) params.set('download', 'true');
    if (options?.fileName) params.set('fileName', options.fileName);
    const query = params.toString() ? `?${params.toString()}` : '';
    return Promise.resolve(
      `${this._httpBaseUrl}/${this._activeContainer}/${fileName}${query}`,
    );
  }

  container(name: string): IStorageProvider {
    this._activeContainer = name;
    return this;
  }

  containerExists(name: string): Promise<boolean | Error> {
    return this.folderExists(name);
  }

  createContainer(name: string, _isPublic?: boolean): Promise<boolean | Error> {
    // Local storage serves all files through the embedded HTTP file server;
    // public/private access is enforced at the Conduit handler layer, not
    // at the storage-provider layer, so container-level ACLs don't apply here.
    this._activeContainer = name;
    return this.createFolder(name);
  }

  setContainerPublicAccess(_name: string, _isPublic: boolean): Promise<boolean | Error> {
    return Promise.resolve(true);
  }
}

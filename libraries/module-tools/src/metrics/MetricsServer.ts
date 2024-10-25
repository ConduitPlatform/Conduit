import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Registry } from 'prom-client';
import { isNaN } from 'lodash';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

export class MetricsServer {
  private readonly moduleName: string;
  private readonly instance: string;
  private readonly Registry: Registry;

  constructor(moduleName: string, instance: string, registry: Registry) {
    this.moduleName = moduleName;
    this.instance = instance;
    this.Registry = registry;
  }

  initialize() {
    const port = this.getHttpPort();
    const url = '0.0.0.0:' + port.toString();
    const server = createServer(this.requestHandler.bind(this));

    server.listen(port, () => {
      ConduitGrpcSdk.Logger.info(`Metrics server listening on: ${url}`);
    });

    return server;
  }

  private async requestHandler(req: IncomingMessage, res: ServerResponse) {
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(
        `Conduit Metrics for module: ${this.moduleName}, instance: ${this.instance}`,
      );
    } else if (req.url === '/metrics' && req.method === 'GET') {
      const metrics = await this.Registry.metrics();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(metrics);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }

  private getHttpPort() {
    const value = process.env['METRICS_PORT'];
    if (!value) {
      ConduitGrpcSdk.Logger.error(`Metrics HTTP port not set`);
      process.exit(-1);
    }
    const port = parseInt(value, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      ConduitGrpcSdk.Logger.error(`Invalid HTTP port value: ${port}`);
      process.exit(-1);
    }
    return port;
  }
}

import ConduitGrpcSdk from '../index';
import express from 'express';
import * as client from 'prom-client';

export class MetricsServer {
  private readonly moduleName: string;
  private readonly instance: string;
  private readonly Registry: client.Registry;

  constructor(moduleName: string, instance: string, registry: client.Registry) {
    this.moduleName = moduleName;
    this.instance = instance;
    this.Registry = registry;
  }

  initialize() {
    this._initialize();
  }

  private _initialize() {
    const server = express();
    const port = process.env.METRICS_PORT || 9091;
    const url = '0.0.0.0:' + port.toString();
    server.listen(port, () => {
      ConduitGrpcSdk.Logger.info(`Metrics server listening on: ${url}`);
    });
    server.get('/', (req: express.Request, res: express.Response) => {
      return res
        .status(200)
        .send(
          `Conduit Metrics for module: ${this.moduleName}, instance: ${this.instance}`,
        );
    });
    server.get('/metrics', async (req: express.Request, res: express.Response) => {
      return res.status(200).send(await this.Registry.metrics());
    });
    server.get(
      '/metrics/counter/:name',
      async (req: express.Request, res: express.Response) => {
        return res
          .status(200)
          .send(await this.Registry.getSingleMetricAsString(req.params.name));
      },
    );
    return server;
  }
}

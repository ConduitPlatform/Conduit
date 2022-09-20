import ConduitGrpcSdk from '../index';
import express from 'express';
import * as client from 'prom-client';
import { isNaN } from 'lodash';

export class MetricsServer {
  private readonly moduleName: string;
  private readonly instance: string;
  private readonly Registry: client.Registry;

  constructor(
    moduleName: string,
    instance: string,
    registry: client.Registry,
    private readonly initializeMetrics?: () => Promise<void>,
  ) {
    this.moduleName = moduleName;
    this.instance = instance;
    this.Registry = registry;
  }

  initialize() {
    const server = express();
    const port = this.getHttpPort();
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
      const metrics = await this.Registry.metrics();
      return res.status(200).send(metrics);
    });
    server.post('/metrics/reset', async (req: express.Request, res: express.Response) => {
      this.Registry.resetMetrics();
      await this.initializeMetrics?.();
      return res.status(200).send({
        message: 'Metrics reset',
      });
    });
    return server;
  }

  getHttpPort() {
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

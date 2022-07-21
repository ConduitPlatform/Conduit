import * as client from 'prom-client';
import http from 'http';
import ConduitGrpcSdk from '../index';

export class ConduitMetrics {
  private readonly Registry: client.Registry;

  constructor() {
    this.Registry = client.register; //global registry

    const requestListener = async (
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Conduit Metrics\n');
      } else if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': this.Registry.contentType });
        res.end(await this.Registry.metrics());
      } else if (req.url === '/metrics/counter') {
        res.writeHead(200, { 'Content-Type': this.Registry.contentType });
        res.end(await this.Registry.getSingleMetricAsString('conduit_counter'));
      }
    };
    const server = http.createServer(requestListener);
    const port = process.env.METRICS_PORT || 9091;
    const url = '0.0.0.0:' + port.toString();
    server.listen(port, () => {
      ConduitGrpcSdk.Logger.info(`Metrics server listening on: ${url}`);
    });
  }

  addMetric(metric: client.Metric<any>, moduleName: string) {}
}

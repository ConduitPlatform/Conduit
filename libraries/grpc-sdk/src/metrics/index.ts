import * as client from 'prom-client';
import { MetricType } from '../types';
import {
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  SummaryConfiguration,
} from 'prom-client';
import { MetricsServer } from './MetricsServer';

export class ConduitMetrics {
  private readonly moduleName: string;
  private readonly instance: string;
  private readonly Registry: client.Registry;
  private _httpServer: MetricsServer;

  constructor(moduleName: string, instance: string) {
    this.moduleName = moduleName;
    this.instance = instance;
    this.Registry = client.register; //global registry
    this._httpServer = new MetricsServer(moduleName, instance, this.Registry);
    this._httpServer.initialize();
    this.collectDefaultMetrics();
  }

  setDefaultLabels(labels: { [key: string]: string }) {
    this.Registry.setDefaultLabels(labels);
  }

  collectDefaultMetrics() {
    const collectDefaultMetrics = client.collectDefaultMetrics;
    collectDefaultMetrics({
      labels: {
        module: this.moduleName,
        instance: this.instance,
      },
    });
  }

  createCounter(config: CounterConfiguration<any>) {
    return new client.Counter(config);
  }
  createSummary(config: SummaryConfiguration<any>) {
    return new client.Summary(config);
  }
  createHistogram(config: HistogramConfiguration<any>) {
    return new client.Histogram(config);
  }
  createGauge(config: GaugeConfiguration<any>) {
    return new client.Gauge(config);
  }
}

import * as client from 'prom-client';
import {
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  LabelValues,
  SummaryConfiguration,
} from 'prom-client';
import { MetricsServer } from './MetricsServer';
import { registry as niceGrpcRegistry } from 'nice-grpc-prometheus';

export class ConduitMetrics {
  private readonly moduleName: string;
  private readonly instance: string;
  private readonly Registry: client.Registry;
  private _httpServer: MetricsServer;

  constructor(moduleName: string, instance: string) {
    this.moduleName = moduleName;
    this.instance = instance;
    const globalRegistry = new client.Registry();
    this.Registry = client.Registry.merge([globalRegistry, niceGrpcRegistry]);
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
    return new client.Counter({ ...config, registers: [this.Registry] });
  }

  createSummary(config: SummaryConfiguration<any>) {
    return new client.Summary({ ...config, registers: [this.Registry] });
  }

  createHistogram(config: HistogramConfiguration<any>) {
    return new client.Histogram({ ...config, registers: [this.Registry] });
  }

  createGauge(config: GaugeConfiguration<any>) {
    return new client.Gauge({ ...config, registers: [this.Registry] });
  }

  getMetric(name: string) {
    return this.Registry.getSingleMetric(name);
  }

  increment(metric: string, increment: number = 1, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (
      !(metricInstance instanceof client.Counter) &&
      !(metricInstance instanceof client.Gauge)
    ) {
      throw new Error(`Metric ${metric} is not an incrementable metric`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).inc(increment)
      : metricInstance.inc(increment);
  }

  decrement(metric: string, decrement: number = 1, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (!(metricInstance instanceof client.Gauge)) {
      throw new Error(`Metric ${metric} is not a decrementable metric`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).dec(decrement)
      : metricInstance.dec(decrement);
  }

  set(metric: string, value: number, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (!(metricInstance instanceof client.Gauge)) {
      throw new Error(`Metric ${metric} is not a Gauge`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).set(value)
      : metricInstance.set(value);
  }

  observe(metric: string, value: number, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (
      !(metricInstance instanceof client.Histogram) &&
      !(metricInstance instanceof client.Summary)
    ) {
      throw new Error(`Metric ${metric} is not a Histogram`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).observe(value)
      : metricInstance.observe(value);
  }

  private addPrefix(metric: string) {
    return `conduit_${metric}`;
  }
}

import * as client from 'prom-client';
import {
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  LabelValues,
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
    this.Registry = new client.Registry(); //global registry
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

  increment(metric: string, increment: number = 1) {
    const metricInstance = this.Registry.getSingleMetric(metric);
    if (
      !(metricInstance instanceof client.Counter) &&
      !(metricInstance instanceof client.Gauge)
    ) {
      throw new Error(`Metric ${metric} is not an incrementable metric`);
    }
    return metricInstance.inc(increment);
  }

  decrement(metric: string, decrement: number = 1) {
    const metricInstance = this.Registry.getSingleMetric(metric);
    if (!(metricInstance instanceof client.Gauge)) {
      throw new Error(`Metric ${metric} is not a decrementable metric`);
    }
    return metricInstance.dec(decrement);
  }

  set(metric: string, value: number) {
    const metricInstance = this.Registry.getSingleMetric(metric);
    if (!(metricInstance instanceof client.Gauge)) {
      throw new Error(`Metric ${metric} is not a Gauge`);
    }
    return metricInstance.set(value);
  }

  setOnLabel(metric: string, labels: LabelValues<any>, value: number) {
    const metricInstance = this.Registry.getSingleMetric(metric);
    if (!(metricInstance instanceof client.Gauge)) {
      throw new Error(`Metric ${metric} is not a Gauge`);
    }
    return metricInstance.set(labels, value);
  }

  observe(metric: string, value: number) {
    const metricInstance = this.Registry.getSingleMetric(metric);
    if (
      !(metricInstance instanceof client.Histogram) &&
      !(metricInstance instanceof client.Summary)
    ) {
      throw new Error(`Metric ${metric} is not a Histogram`);
    }
    return metricInstance.observe(value);
  }
}

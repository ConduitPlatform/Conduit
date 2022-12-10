import {
  collectDefaultMetrics,
  Counter,
  CounterConfiguration,
  Gauge,
  GaugeConfiguration,
  Histogram,
  HistogramConfiguration,
  LabelValues,
  Registry,
  Summary,
  SummaryConfiguration,
} from 'prom-client';
import { MetricsServer } from './MetricsServer';
import defaultMetrics from './config/defaults';
import { MetricConfiguration, MetricType } from '../types';

export class ConduitMetrics {
  private readonly moduleName: string;
  private readonly instance: string;
  private readonly Registry: Registry;
  private _httpServer: MetricsServer;

  constructor(moduleName: string, instance: string) {
    this.moduleName = moduleName;
    this.instance = instance;
    const globalRegistry = new Registry();
    globalRegistry.setDefaultLabels({ module: this.moduleName });
    this.Registry = Registry.merge([globalRegistry, new Registry()]);
    this.collectDefaultMetrics();
    this._httpServer = new MetricsServer(moduleName, instance, this.Registry);
    this._httpServer.initialize();
  }

  initializeDefaultMetrics() {
    for (const metric of Object.values(defaultMetrics)) {
      this.registerMetric(metric.type, metric.config);
    }
  }

  registerMetric(type: MetricType, config: MetricConfiguration) {
    if (this.getMetric(config.name)) return;
    const metricConfig = JSON.parse(JSON.stringify(config));
    metricConfig.name = this.addPrefix(config.name);
    switch (type) {
      case MetricType.Counter:
        this.createCounter(metricConfig as CounterConfiguration<any>);
        break;
      case MetricType.Gauge:
        this.createGauge(metricConfig as GaugeConfiguration<any>);
        break;
      case MetricType.Histogram:
        this.createHistogram(metricConfig as HistogramConfiguration<any>);
        break;
      case MetricType.Summary:
        this.createSummary(metricConfig as SummaryConfiguration<any>);
        break;
    }
  }

  setDefaultLabels(labels: { [key: string]: string }) {
    this.Registry.setDefaultLabels(labels);
  }

  collectDefaultMetrics() {
    collectDefaultMetrics({
      register: this.Registry,
      prefix: 'conduit_',
      labels: {
        module: this.moduleName,
        instance: this.instance,
      },
    });
  }

  createCounter(config: CounterConfiguration<any>) {
    return new Counter({ ...config, registers: [this.Registry] });
  }

  createSummary(config: SummaryConfiguration<any>) {
    return new Summary({ ...config, registers: [this.Registry] });
  }

  createHistogram(config: HistogramConfiguration<any>) {
    return new Histogram({ ...config, registers: [this.Registry] });
  }

  createGauge(config: GaugeConfiguration<any>) {
    return new Gauge({ ...config, registers: [this.Registry] });
  }

  getMetric(name: string) {
    return this.Registry.getSingleMetric(this.addPrefix(name));
  }

  increment(metric: string, increment: number = 1, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (!(metricInstance instanceof Counter) && !(metricInstance instanceof Gauge)) {
      throw new Error(`Metric ${metric} is not an incrementable metric`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).inc(increment)
      : metricInstance.inc(increment);
  }

  decrement(metric: string, decrement: number = 1, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (!(metricInstance instanceof Gauge)) {
      throw new Error(`Metric ${metric} is not a decrementable metric`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).dec(decrement)
      : metricInstance.dec(decrement);
  }

  set(metric: string, value: number, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (!(metricInstance instanceof Gauge)) {
      throw new Error(`Metric ${metric} is not a Gauge`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).set(value)
      : metricInstance.set(value);
  }

  observe(metric: string, value: number, labels?: LabelValues<any>) {
    const metricInstance = this.Registry.getSingleMetric(this.addPrefix(metric));
    if (!(metricInstance instanceof Histogram) && !(metricInstance instanceof Summary)) {
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

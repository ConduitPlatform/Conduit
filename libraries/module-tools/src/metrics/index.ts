import {
  collectDefaultMetrics,
  Counter,
  CounterConfiguration,
  Gauge,
  GaugeConfiguration,
  Histogram,
  HistogramConfiguration,
  LabelValues,
  MetricConfiguration,
  Registry,
  Summary,
  SummaryConfiguration,
} from 'prom-client';
import { MetricsServer } from './MetricsServer.js';
import defaultMetrics from './config/defaults.js';
import { IConduitMetrics, MetricType } from '@conduitplatform/grpc-sdk';

const METRICS_PREFIX = 'cnd_';

export class ConduitMetrics implements IConduitMetrics {
  private readonly moduleName: string;
  private readonly instance: string;
  private readonly _registry: Registry;
  private _httpServer: MetricsServer;

  constructor(moduleName: string, instance: string) {
    this.moduleName = moduleName;
    this.instance = instance;
    this._registry = new Registry();
    this._registry.setDefaultLabels({
      module_name: this.moduleName,
      module_instance: this.instance,
    });
    this.collectDefaultMetrics();
    this._httpServer = new MetricsServer(moduleName, instance, this._registry);
    this._httpServer.initialize();
  }

  get registry() {
    return this._registry;
  }

  initializeDefaultMetrics() {
    for (const metric of Object.values(defaultMetrics)) {
      this.registerMetric(metric.type as unknown as MetricType, metric.config);
    }
  }

  registerMetric(type: MetricType, config: MetricConfiguration<string>) {
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

  collectDefaultMetrics() {
    collectDefaultMetrics({
      register: this._registry,
      prefix: METRICS_PREFIX,
      // probably not needed
      labels: {
        module_name: this.moduleName,
        instance_instance: this.instance,
      },
    });
  }

  createCounter(config: CounterConfiguration<any>) {
    return new Counter({
      ...config,
      name: this.addPrefix(config.name),
      registers: [this._registry],
    });
  }

  createSummary(config: SummaryConfiguration<any>) {
    return new Summary({
      ...config,
      name: this.addPrefix(config.name),
      registers: [this._registry],
    });
  }

  createHistogram(config: HistogramConfiguration<any>) {
    return new Histogram({
      ...config,
      name: this.addPrefix(config.name),
      registers: [this._registry],
    });
  }

  createGauge(config: GaugeConfiguration<any>) {
    return new Gauge({
      ...config,
      name: this.addPrefix(config.name),
      registers: [this._registry],
    });
  }

  getMetric(name: string) {
    return this._registry.getSingleMetric(this.addPrefix(name));
  }

  increment(metric: string, increment: number = 1, labels?: LabelValues<any>) {
    const metricInstance = this.getMetric(metric);
    if (!(metricInstance instanceof Counter) && !(metricInstance instanceof Gauge)) {
      throw new Error(`Metric ${metric} is not an incrementable metric`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).inc(increment)
      : metricInstance.inc(increment);
  }

  decrement(metric: string, decrement: number = 1, labels?: LabelValues<any>) {
    const metricInstance = this.getMetric(metric);
    if (!(metricInstance instanceof Gauge)) {
      throw new Error(`Metric ${metric} is not a decrementable metric`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).dec(decrement)
      : metricInstance.dec(decrement);
  }

  set(metric: string, value: number, labels?: LabelValues<any>) {
    const metricInstance = this.getMetric(metric);
    if (!(metricInstance instanceof Gauge)) {
      throw new Error(`Metric ${metric} is not a Gauge`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).set(value)
      : metricInstance.set(value);
  }

  observe(metric: string, value: number, labels?: LabelValues<any>) {
    const metricInstance = this.getMetric(metric);
    if (!(metricInstance instanceof Histogram) && !(metricInstance instanceof Summary)) {
      throw new Error(`Metric ${metric} is not a Histogram`);
    }
    return labels
      ? metricInstance.labels({ ...labels }).observe(value)
      : metricInstance.observe(value);
  }

  private addPrefix(metric: string) {
    if (!metric.includes(METRICS_PREFIX)) {
      return `${METRICS_PREFIX}${metric}`;
    }
    return metric;
  }
}

import {
  Counter,
  CounterConfiguration,
  Gauge,
  GaugeConfiguration,
  Histogram,
  HistogramConfiguration,
  LabelValues,
  Metric,
  MetricConfiguration,
  MetricType,
  Summary,
  SummaryConfiguration,
} from 'prom-client';

export interface IConduitMetrics {
  initializeDefaultMetrics(): void;

  registerMetric(type: MetricType, config: MetricConfiguration<string>): void;

  collectDefaultMetrics(): void;

  createCounter(config: CounterConfiguration<any>): Counter<any>;

  createSummary(config: SummaryConfiguration<any>): Summary<any>;
  createHistogram(config: HistogramConfiguration<any>): Histogram<any>;

  createGauge(config: GaugeConfiguration<any>): Gauge<any>;

  getMetric(name: string): Metric<string> | undefined;

  increment(metric: string, increment?: number, labels?: LabelValues<any>): void;

  decrement(metric: string, decrement?: number, labels?: LabelValues<any>): void;

  set(metric: string, value: number, labels?: LabelValues<any>): void;
  observe(metric: string, value: number, labels?: LabelValues<any>): void;
}

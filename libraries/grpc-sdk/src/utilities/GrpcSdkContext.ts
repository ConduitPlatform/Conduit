import { IConduitLogger, IConduitMetrics } from '../interfaces/index.js';

// Static logger instance (defaults to console)
let _logger: IConduitLogger | Console = console;

// Static metrics instance
let _metrics: IConduitMetrics | undefined = undefined;

// Static middleware/interceptors array
let _middleware: any[] = [];

/**
 * Get the current logger instance
 */
export function getLogger(): IConduitLogger | Console {
  return _logger;
}

/**
 * Set the logger instance
 */
export function setLogger(logger: IConduitLogger | Console): void {
  _logger = logger;
}

/**
 * Get the current metrics instance
 */
export function getMetrics(): IConduitMetrics | undefined {
  return _metrics;
}

/**
 * Set the metrics instance
 */
export function setMetrics(metrics: IConduitMetrics | undefined): void {
  _metrics = metrics;
}

/**
 * Get the current middleware/interceptors array
 */
export function getInterceptors(): any[] {
  return _middleware;
}

/**
 * Add middleware to the interceptors array
 */
export function addMiddleware(middleware: any): void {
  _middleware.push(middleware);
}

/**
 * Clear all middleware
 */
export function clearMiddleware(): void {
  _middleware = [];
}

import type { SocketSettings } from '@conduitplatform/hermes';
import type { Config } from './index.js';

/** Maps the Router's `sockets` config onto hermes socket settings. */
export function socketSettingsFromConfig(
  config: Partial<Config>,
): Partial<SocketSettings> {
  const sockets = config.sockets;
  const rateLimit = sockets?.rateLimit;
  return {
    maxHttpBufferSize: sockets?.maxHttpBufferSize,
    eventRateLimit:
      rateLimit?.enabled === false
        ? undefined
        : {
            burst: rateLimit?.burst ?? 100,
            perSecond: rateLimit?.eventsPerSecond ?? 30,
          },
    disconnectOnTokenExpiry: sockets?.disconnectOnTokenExpiry ?? true,
  };
}

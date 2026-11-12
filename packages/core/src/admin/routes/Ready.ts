import {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import {
  ConduitBoolean,
  ConduitNumber,
  ConduitString,
  ModuleError,
} from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import type { ReadinessService } from '../../health/ReadinessService.js';

export function getReadyRoute(readinessService: ReadinessService) {
  return new ConduitRoute(
    {
      path: '/ready',
      action: ConduitRouteActions.GET,
      description: 'Deep readiness probe for Core coordination health.',
      queryParams: {
        legacy: ConduitBoolean.Optional,
      },
      errors: [errors.CORE_NOT_READY],
    },
    new ConduitRouteReturnDefinition('Ready', {
      status: ConduitString.Required,
      message: ConduitString.Required,
      checks: [
        {
          name: ConduitString.Required,
          status: ConduitString.Required,
          message: ConduitString.Optional,
          latencyMs: ConduitNumber.Optional,
        },
      ],
      timestamp: ConduitString.Required,
    }),
    async () => {
      const report = await readinessService.evaluate();
      if (report.status === 'not_ready') {
        throw new ModuleError(errors.CORE_NOT_READY, report.message);
      }
      return report;
    },
  );
}

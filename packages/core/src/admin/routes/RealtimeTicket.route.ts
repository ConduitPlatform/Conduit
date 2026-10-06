import { isNil } from 'lodash-es';
import { ConduitRoute } from '@conduitplatform/hermes';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitNumber,
  ConduitString,
  ConfigController,
} from '@conduitplatform/module-tools';
import { signToken } from '../utils/auth.js';
import {
  ADMIN_REALTIME_TICKET_TTL_SECONDS,
  buildRealtimeTicketClaims,
} from '../realtime/ticket.js';

export function getRealtimeTicketRoute() {
  return new ConduitRoute(
    {
      path: '/realtime/ticket',
      action: ConduitRouteActions.POST,
      mcp: false,
      description:
        'Issue a short-lived token for Admin Socket.IO handshakes. The token cannot be used for REST or GraphQL.',
    },
    new ConduitRouteReturnDefinition('RealtimeTicket', {
      token: ConduitString.Required,
      expiresIn: ConduitNumber.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const admin = req.context?.admin;
      if (isNil(admin) || isNil(admin._id)) {
        throw new ConduitError('UNAUTHORIZED', 401, 'Authentication required');
      }
      const adminId = admin._id.toString();
      const authConfig = ConfigController.getInstance().config.auth;
      const token = signToken(
        buildRealtimeTicketClaims(adminId),
        authConfig.tokenSecret,
        ADMIN_REALTIME_TICKET_TTL_SECONDS,
      );
      return {
        token,
        expiresIn: ADMIN_REALTIME_TICKET_TTL_SECONDS,
      };
    },
  );
}

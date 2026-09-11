export const ADMIN_REALTIME_AUDIENCE = 'admin-realtime';
export const ADMIN_REALTIME_TICKET_TTL_SECONDS = 30;

export type RealtimeTicketClaims = {
  id: string;
  aud?: string | string[];
  twoFaRequired?: boolean;
};

export function buildRealtimeTicketClaims(adminId: string): RealtimeTicketClaims {
  return {
    id: adminId,
    aud: ADMIN_REALTIME_AUDIENCE,
  };
}

export function isRealtimeTicket(
  decoded: RealtimeTicketClaims | null | undefined,
): boolean {
  if (!decoded) return false;
  const audience = decoded.aud;
  if (Array.isArray(audience)) {
    return audience.includes(ADMIN_REALTIME_AUDIENCE);
  }
  return audience === ADMIN_REALTIME_AUDIENCE;
}

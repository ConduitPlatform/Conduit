const CHANGE_STREAM_ERROR_CODES = new Set([
  136, // CappedPositionLost
  237, // CursorKilled
  280, // ChangeStreamHistoryLost
  286, // ChangeStreamFatalError
]);

export type TopologyResult = {
  supported: boolean;
  message?: string;
};

export function topologyFromHello(
  hello:
    | {
        setName?: string;
        msg?: string;
      }
    | null
    | undefined,
): TopologyResult {
  if (!hello) {
    return { supported: false, message: 'Unable to determine MongoDB topology' };
  }
  if (hello.msg === 'isdbgrid' || Boolean(hello.setName)) {
    return { supported: true };
  }
  return {
    supported: false,
    message: 'A replica set or sharded MongoDB deployment is required for live updates',
  };
}

export function isResumeTokenUnusable(error: unknown): boolean {
  const code = extractErrorCode(error);
  if (code !== undefined && CHANGE_STREAM_ERROR_CODES.has(code)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /resume token|ChangeStreamHistoryLost|cannot resume/i.test(message);
}

function extractErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { code?: unknown; errorCode?: unknown };
  if (typeof candidate.code === 'number') return candidate.code;
  if (typeof candidate.errorCode === 'number') return candidate.errorCode;
  return undefined;
}

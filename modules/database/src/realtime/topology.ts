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

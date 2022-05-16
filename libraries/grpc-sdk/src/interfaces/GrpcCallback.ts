export type GrpcCallback<ResponseType> = (
  error: { code: number; message: string } | null,
  response?: ResponseType,
) => void;
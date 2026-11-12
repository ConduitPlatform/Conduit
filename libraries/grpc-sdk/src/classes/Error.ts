export class ConduitError extends Error {
  message: string;
  name: string;
  status: number;
  /** Stable machine-readable code, sent to clients next to `name` and `message`. */
  conduitCode?: string;

  constructor(name: string, status: number, message: string, conduitCode?: string) {
    super(message);
    this.name = name;
    this.message = message;
    this.status = status;
    if (conduitCode) this.conduitCode = conduitCode;
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new ConduitError('UNAUTHORIZED', 401, message);
  }

  static notFound(message: string = 'Resource not found') {
    return new ConduitError('NOT_FOUND', 404, message);
  }

  static forbidden(message: string = 'Forbidden') {
    return new ConduitError('FORBIDDEN', 403, message);
  }

  static userInput(message: string = 'Request data are invalid') {
    return new ConduitError('USER_INPUT_ERROR', 400, message);
  }

  static internalServerError(message = 'Something went wrong') {
    throw new ConduitError('INTERNAL_SERVER_ERROR', 500, message);
  }
}

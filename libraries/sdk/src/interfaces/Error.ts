export class ConduitError extends Error {
    message: string;
    name: string;
    status: number;

    constructor(name: string, status: number, message: string) {
        super(message)
        this.name = name;
        this.message = message;
        this.status = status;
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

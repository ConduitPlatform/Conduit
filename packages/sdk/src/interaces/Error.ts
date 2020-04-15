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

}

export class UnauthorizedError extends ConduitError {
    constructor(message: string = 'Unauthorized') {
        super('UNAUTHORIZED', 401, message);
    }
}

export class NotFoundError extends ConduitError {
    constructor(message: string = 'Resource not found') {
        super('NOT_FOUND', 404, message);
    }
}

export class ForbiddenError extends ConduitError {
    constructor(message: string = 'Forbidden') {
        super('FORBIDDEN', 403, message);
    }
}

export class UserInputError extends ConduitError {
    constructor(message: string = 'Request data are invalid') {
        super('USER_INPUT_ERROR', 422, message);
    }
}

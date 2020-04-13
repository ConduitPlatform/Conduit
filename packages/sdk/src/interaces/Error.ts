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

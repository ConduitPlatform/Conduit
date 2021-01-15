export interface ConduitModule {

    initializeClient(): void;

    closeConnection(): void;
}
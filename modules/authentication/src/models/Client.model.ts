import { DatabaseProvider } from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

export class Client extends ConduitActiveSchema<Client> {
  private static _instance: Client;
  _id!: string;
  clientId!: string;
  clientSecret!: string;
  alias?: string;
  notes?: string;
  domain?: string;
  platform!: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(database: DatabaseProvider) {
    super(database, 'Client');
  }

  static getInstance(database?: DatabaseProvider) {
    if (Client._instance) return Client._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    Client._instance = new Client(database);
    return Client._instance;
  }
}

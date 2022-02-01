import { User } from '../../models';

export interface Payload {
  clientId?: string;
  email: string;
  user: User | any;
  data: {
    id: string;
    token: string;
    tokenExpires?: any;
  };
  config: any;
}
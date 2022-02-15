import { Payload } from '../AuthenticationProviders/interfaces/Payload';

export interface FacebookUser extends Payload {
  [key:string]: any;
}

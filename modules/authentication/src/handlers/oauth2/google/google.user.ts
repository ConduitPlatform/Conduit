import { Payload } from '../interfaces/Payload';

export interface GoogleUser extends Payload {
  data: {
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    locale?: string;
    verified_email?: boolean
  },
}

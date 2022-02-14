import { Payload } from '../../handlers/AuthenticationProviders/interfaces/Payload';

export interface FigmaUser extends Payload {
  data: {
    handle?: string;
    image_url?: string;
  }
}
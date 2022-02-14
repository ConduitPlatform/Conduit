import { Payload } from '../../handlers/AuthenticationProviders/interfaces/Payload';

export interface FigmaUser extends Payload {
  data: {
    hande: string;
    image_url: string;
  }
}
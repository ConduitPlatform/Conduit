import { Payload } from '../interfaces/Payload';

export interface SlackUser extends Payload {
  data: {
    avatar_hash: string,
    status_text: string,
    status_emoji: string,
    status_expiration: number
    real_name: string,
    display_name: string,
    real_name_normalized: string,
    display_name_normalized: string,
    email: string,
    image_original: string,
    image_24: string,
    image_32: string,
    image_48: string,
    image_72: string,
    image_192: string,
    image_512: string,
    team: string
  };

}

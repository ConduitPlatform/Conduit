import { Payload } from '../AuthenticationProviders/interfaces/Payload';

export interface TwitchUser extends Payload {
  data: {
    display_name?: string;
    profile_image_url?: string;
    offline_image_url?: string;
    login?: string;
    broadcaster_type?: string;
    type?: string;
    description?: string;
    view_count?: string;
  }
}

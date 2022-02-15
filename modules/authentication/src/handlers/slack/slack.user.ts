import { Payload } from '../AuthenticationProviders/interfaces/Payload';

export interface SlackUser extends Payload {
  data: {
    first_name?: string;
    last_name?: string;
    title?: string;
    phone?: string;
    skype?: string;
    real_name?: string;
    display_name?: string;
    status_text?: string;
    status_emoji?: string;
    fields?: string;

  }

}
import { SlackUser } from './slack.user.js';

export interface SlackResponse {
  data: {
    ok: boolean;
    profile: SlackUser;
  };
}

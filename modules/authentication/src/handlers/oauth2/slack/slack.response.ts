import { SlackUser } from './slack.user';

export interface SlackResponse {
  data: {
    ok: boolean;
    profile: SlackUser;
  };
}

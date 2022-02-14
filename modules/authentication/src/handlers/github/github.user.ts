import { Payload } from '../AuthenticationProviders/interfaces/Payload';

export interface GithubUser extends Payload {
  data: {
    name: string;
    bio: string;
    location: string;
    company: string;
    avatar_url: string;
    url: string;
    html_url?: string;
    followers_url?: string;
    following_url?: string;
    repos_url?: string;
    organizations_url?: string;
    subscriptions_url?: string;
    starred_url?: string;
  }
}

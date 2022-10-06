export interface GitlabUser {
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
  created_at: string;
  bio?: string;
  bot: boolean;
  location?: string;
  public_email?: string;
  skype?: string;
  linkedin?: string;
  twitter?: string;
  website_url?: string;
  organization?: string;
  job_title?: string;
  pronouns?: string;
  work_information?: string;
  followers: number;
  following: number;
  local_time?: string;
  is_followed: boolean;
  last_sign_in_at: string;
  confirmed_at: string;
  last_activity_on: string;
  theme_id: number;
  color_scheme_id: number;
  projects_limit: number;
  current_sign_in_at: string;
  identities: [
    {
      provider?: string;
      extern_uid?: string;
      saml_provider_id?: string;
    },
  ];
  can_create_group: boolean;
  can_create_project: boolean;
  two_factor_enabled: boolean;
  external: boolean;
  private_profile: boolean;
  commit_email: string;
  shared_runners_minutes_limit?: number;
  extra_shared_runners_minutes_limit?: number;
}

export interface BitbucketUser {
  display_name: string;
  created_on?: string;
  type: string;
  uuid: string;
  has_2fa_enabled: boolean;
  username: string;
  is_staff: boolean;
  account_id: string;
  nickname: string;
  account_status: string;
  location?: string;
  website?: string;
}

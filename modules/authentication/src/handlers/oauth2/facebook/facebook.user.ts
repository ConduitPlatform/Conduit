export interface FacebookExperience {
  id: string;
  description: string;
  from: FacebookUser;
  name: string;
  with: FacebookUser[];
}

export interface FacebookUser {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  middle_name?: string;
  picture?: string;
  short_name?: string;
  name_format?: string;
  about?: string;
  age_range?: { max: number; min: number };
  birthday?: string;
  education?: FacebookExperience[];
  email?: string;
  favorite_athletes?: FacebookExperience[];
  favorite_teams?: FacebookExperience[];
  gender?: string;
  hometown?: string;
  inspirational_people?: FacebookExperience[];
  installed?: boolean;
  is_guest_user?: boolean;
  languages?: FacebookExperience[];
  link?: string;
  location?: string;
  meeting_for?: string[];
  political?: string;
  quotes?: string;
  relationship_status?: string;
  shared_login_upgrade_required_by?: Date;
  significant_other?: FacebookUser;
  sports?: FacebookExperience[];
  supports_donate_button_in_live_video?: boolean;
  token_for_business?: string;
  video_upload_limits?: string;
  website?: string;
}

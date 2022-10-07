export interface AppleUser {
  name: { firstName: string; lastName: string };
  isPrivateEmail?: boolean;
  email_verified?: boolean;
  real_user_status?: number;
}

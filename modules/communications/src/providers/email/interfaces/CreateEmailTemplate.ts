export interface CreateEmailTemplate {
  name: string;
  body: string;
  subject?: string;
  versionName?: string;
  active?: boolean;
}

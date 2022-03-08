export interface MandrillTemplate {
  slug: string;
  name: string;
  labels: string[];
  code: string;
  subject: string;
  from_email: string;
  from_name: string;
  text: string;
  publish_name: string;
  publish_code: string;
  publish_subject: string;
  publish_from_email: string;
  publish_from_name: string;
  publish_text: string;
  published_at: any;
  created_at: any;
  updated_at: any;
}
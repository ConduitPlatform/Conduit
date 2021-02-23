export interface MailgunConfig {
  auth: {
    api_key: string;
    domain: string;
  };
  proxy?: string;
  host: string;
}

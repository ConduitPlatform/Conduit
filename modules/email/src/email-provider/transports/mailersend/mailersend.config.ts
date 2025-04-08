export interface MailersendConfig {
  host: string;
  port: number;
  auth: {
    user: string;
    pass: string;
    apiKey: string;
  };
}

export interface Config {
  active: boolean;
  transport: string;
  sendingDomain: string;
  transportSettings: {
    mailgun: {
      apiKey: string;
      domain: string;
      host: string
      proxy: any,
    },
    smtp: {
      port: number;
      host: string;
      auth: {
        username: string;
        password: string;
        method: string;
      },
    },
    mandrill: {
      apiKey: string;
    },
    sendgrid: {
      apiKey: string;
      apiUser: string;
    },
  },
};
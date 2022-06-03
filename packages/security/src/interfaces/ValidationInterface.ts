export interface ValidationInterface {
  validated?: any;
  client?: {
    platform: string;
    domain: string;
    clientSecret: string;
  };
}

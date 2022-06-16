export interface ValidationInterface {
  validated?: boolean;
  client?: {
    platform: string;
    domain: string;
    clientSecret: string;
  };
}

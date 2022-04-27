export interface Cookie {
  name: string;
  value: string;
  options?: {
    httpOnly?: boolean;
    secure?: boolean;
    maxAge?: number;
    signed?: boolean;
  }
}
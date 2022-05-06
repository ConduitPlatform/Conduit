export interface Cookie {
  name: string;
  value: string;
  options?: {
    httpOnly?: boolean;
    secure?: boolean;
    maxAge?: number;
    signed?: boolean;
    sameSite?: string;
    domain?: string;
    path: string;
  };
}
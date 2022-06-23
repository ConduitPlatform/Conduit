import { CookieOptions } from 'express';

export interface Cookie {
  name: string;
  value: string;
  options: CookieOptions;
}

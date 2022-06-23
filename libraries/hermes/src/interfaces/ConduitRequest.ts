import { Request } from 'express';

export interface ConduitRequest extends Request {
  conduit?: { [key: string]: any };
}

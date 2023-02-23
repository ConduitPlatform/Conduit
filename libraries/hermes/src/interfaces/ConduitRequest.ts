import { Request } from 'express';
import { Indexable } from '@conduitplatform/grpc-sdk';

export interface ConduitRequest extends Request {
  conduit?: Indexable;
}

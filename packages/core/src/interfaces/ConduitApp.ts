import { Application } from 'express';
import { ConduitSDK } from '@conduit/sdk';

export interface ConduitApp extends Application {
  conduit: ConduitSDK;
  initialized: boolean;
}

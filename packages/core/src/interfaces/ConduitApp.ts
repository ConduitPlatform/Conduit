import { Application } from 'express';
import { ConduitSDK } from '@quintessential-sft/conduit-sdk';

export interface ConduitApp extends Application {
  conduit: ConduitSDK;
  initialized: boolean;
}

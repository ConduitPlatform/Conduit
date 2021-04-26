import { Application } from 'express';
import { ConduitCommons } from '@quintessential-sft/conduit-commons';

export interface ConduitApp extends Application {
  conduit: ConduitCommons;
  initialized: boolean;
}

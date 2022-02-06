import { Application } from 'express';
import { ConduitCommons } from '@conduitplatform/conduit-commons';

export interface ConduitApp extends Application {
  conduit: ConduitCommons;
  initialized: boolean;
}

export enum ModuleLifecycleStage {
  CREATE_GRPC = 'pre-register',
  PRE_SERVER_START = 'post-register',
  SERVER_STARTED = 'pre-activate',
  PRE_REGISTER = 'post-activate',
  POST_REGISTER = 'pre-deactivate',
}

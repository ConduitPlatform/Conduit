export enum ModuleLifecycleStage {
  CREATE_GRPC = 'creat-grpc-server',
  PRE_SERVER_START = 'pre-grpc-start',
  SERVER_STARTED = 'grpc-server-started',
  PRE_REGISTER = 'pre-register',
  POST_REGISTER = 'post-register',
}

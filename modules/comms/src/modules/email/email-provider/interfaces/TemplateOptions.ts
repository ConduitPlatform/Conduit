import { Indexable } from '@conduitplatform/grpc-sdk';

export interface TemplateOptions {
  id: string;
  variables: Indexable;
}

import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ResourceDefinition, ActorIndex } from '../models';

export class IndexController {
  private static _instance: IndexController;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (IndexController._instance) return IndexController._instance;
    if (grpcSdk) {
      return (IndexController._instance = new IndexController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  // todo
  async constructRelationIndex(subject: string, relation: string, object: string) {
    let subjectDefinition = await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
    });
    if (Object.keys(subjectDefinition!.relations).length === 0) {
      // construct actor index
      await ActorIndex.getInstance().create({
        index: {
          [subject]: `${object}#${relation}`,
        },
      });
    } else {
      // construct object index
    }
  }

  async removeRelationIndex(subject: string, relation: string, object: string) {}

  async findIndex(subject: string, action: string, object: string) {
    return null;
  }
}

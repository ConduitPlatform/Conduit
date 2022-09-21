import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { checkRelation, computeRelationTuple } from '../utils';
import { ResourceDefinition } from '../models/ResourceDefinition.schema';
import { Relationship } from '../models/Relationship.schema';

export class RelationsController {
  private static _instance: RelationsController;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (RelationsController._instance) return RelationsController._instance;
    if (grpcSdk) {
      return (RelationsController._instance = new RelationsController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  async createRelation(subject: string, relation: string, object: string) {
    checkRelation(subject, relation, object);
    let relationResource = await Relationship.getInstance().findOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });
    if (relationResource) throw new Error('Relation already exists');

    let subjectResource = await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
    });
    if (!subjectResource) throw new Error('Subject resource not found');
    let resource = await ResourceDefinition.getInstance()
      .findOne({ name: object.split(':')[0] })
      .then(resourceDefinition => {
        if (!resourceDefinition) {
          throw new Error('Object resource definition not found');
        }
        if (
          !resourceDefinition.relations[relation] ||
          resourceDefinition.relations[relation] !== subject.split(':')[0]
        ) {
          throw new Error('Relation not allowed');
        }
        return resourceDefinition;
      });

    relationResource = await Relationship.getInstance().create({
      subject: subject,
      relation: relation,
      resource: object,
      computedTuple: computeRelationTuple(subject, relation, object),
    });

    return relationResource;
  }

  async deleteRelation(subject: string, relation: string, object: string) {
    checkRelation(subject, relation, object);
    const relationResource = await Relationship.getInstance().findOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });
    if (!relationResource) throw new Error('Relation does not exist');
    return await Relationship.getInstance().deleteOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });
  }

  async getRelation(subject: string, relation: string, object: string) {
    checkRelation(subject, relation, object);
    return await Relationship.getInstance().findOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });
  }

  async findRelations(searchQuery: {
    subject?: string;
    relation?: string;
    object?: string;
  }) {
    const query: { subject?: string; relation?: string; resource?: string } = {};
    if (searchQuery.subject) {
      query['subject'] = searchQuery.subject;
    }
    if (searchQuery.relation) {
      query['relation'] = searchQuery.relation;
    }
    if (searchQuery.object) {
      query['resource'] = searchQuery.object;
    }
    return await Relationship.getInstance().findMany(query);
  }
}

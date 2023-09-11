import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { checkRelation, computeRelationTuple } from '../utils';
import { ActorIndex, Relationship, ResourceDefinition } from '../models';
import { IndexController } from './index.controller';

export class RelationsController {
  private static _instance: RelationsController;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly indexController: IndexController,
  ) {}

  static getInstance(grpcSdk?: ConduitGrpcSdk, indexController?: IndexController) {
    if (RelationsController._instance) return RelationsController._instance;
    if (grpcSdk && indexController) {
      return (RelationsController._instance = new RelationsController(
        grpcSdk,
        indexController,
      ));
    }
    throw new Error('Missing grpcSdk or indexController!');
  }

  async createRelation(subject: string, relation: string, object: string) {
    checkRelation(subject, relation, object);
    let relationResource = await Relationship.getInstance().findOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });
    if (relationResource) throw new Error('Relation already exists');

    const subjectResource = await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
    });
    if (!subjectResource) throw new Error('Subject resource not found');
    await ResourceDefinition.getInstance()
      .findOne({ name: object.split(':')[0] })
      .then(resourceDefinition => {
        if (!resourceDefinition) {
          throw new Error('Object resource definition not found');
        }
        if (resourceDefinition.relations[relation].indexOf('*') !== -1) return;
        if (
          !resourceDefinition.relations[relation] ||
          resourceDefinition.relations[relation].indexOf(subject.split(':')[0]) === -1
        ) {
          throw new Error('Relation not allowed');
        }
      });

    relationResource = await Relationship.getInstance().create({
      subject: subject,
      relation: relation,
      resource: object,
      computedTuple: computeRelationTuple(subject, relation, object),
    });
    await this.indexController.constructRelationIndex(subject, relation, object);
    return relationResource;
  }

  async checkRelations(subject: string, relation: string, resources: string[]) {
    checkRelation(subject, relation, resources[0]);
    const computedTuples = resources.map(r => computeRelationTuple(subject, relation, r));
    const relationResources = await Relationship.getInstance().findMany({
      computedTuple: { $in: computedTuples },
    });
    if (relationResources.length) throw new Error('Relations already exist');
    const subjectResource = await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
    });
    if (!subjectResource) throw new Error('Subject resource not found');
    await ResourceDefinition.getInstance()
      .findOne({ name: resources[0].split(':')[0] })
      .then(resourceDefinition => {
        if (!resourceDefinition) {
          throw new Error('Object resource definition not found');
        }
        if (resourceDefinition.relations[relation].indexOf('*') !== -1) return;
        if (
          !resourceDefinition.relations[relation] ||
          resourceDefinition.relations[relation].indexOf(subject.split(':')[0]) === -1
        ) {
          throw new Error('Relation not allowed');
        }
      });
  }

  async createRelations(subject: string, relation: string, resources: string[]) {
    const entities: string[] = [];
    const relations = resources.map(r => {
      entities.push(`${r}#${relation}`);
      return {
        subject,
        relation,
        resource: r,
        computedTuple: computeRelationTuple(subject, relation, r),
      };
    });

    const relationResource = await Relationship.getInstance().createMany(relations);
    // relations can only be created between actors and resources
    // object indexes represent relations between actors and permissions on resources
    // construct actor index
    const found = await ActorIndex.getInstance().findMany({
      $and: [{ subject: { $eq: subject } }, { entity: { $in: entities } }],
    });
    const toCreate = entities.flatMap(e => {
      const exists = found.find(f => f.entity === e);
      if (exists) return [];
      return {
        subject,
        entity: e,
      };
    });
    await ActorIndex.getInstance().createMany(toCreate);
    await Promise.all(
      relations.map(r =>
        this.indexController.constructRelationIndex(r.subject, r.relation, r.resource),
      ),
    );
    return relationResource;
  }

  async deleteRelation(subject: string, relation: string, object: string) {
    checkRelation(subject, relation, object);
    const relationResource = await Relationship.getInstance().findOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });
    if (!relationResource) throw new Error('Relation does not exist');
    await Relationship.getInstance().deleteOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });

    await this.indexController.removeRelation(subject, relation, object);

    return;
  }

  async deleteAllRelations(query: { subject?: string; resource?: string }) {
    const relationResources = await Relationship.getInstance().findMany(query);
    if (relationResources.length === 0) throw new Error('No relations found');
    await Relationship.getInstance().deleteMany(query);
    for (const relationResource of relationResources) {
      await this.indexController.removeRelation(
        relationResource.subject,
        relationResource.relation,
        relationResource.resource,
      );
    }
    return;
  }

  async deleteRelationById(id: string) {
    const relationResource = await Relationship.getInstance().findOne({ _id: id });
    if (!relationResource) throw new Error('Relation does not exist');
    await Relationship.getInstance().deleteOne({ _id: id });
    await this.indexController.removeRelation(
      relationResource.subject,
      relationResource.relation,
      relationResource.resource,
    );
    return;
  }

  async removeResource(name: string) {
    // delete all relations that could be associated with resource
    await Relationship.getInstance().deleteMany({
      $or: [
        {
          subject: {
            $regex: `${name}.*`,
            $options: 'i',
          },
        },
        { resource: { $regex: `${name}.*`, $options: 'i' } },
      ],
    });
  }

  async removeGeneralRelation(
    subjectResource: string,
    relation: string,
    objectResource: string,
  ) {
    // delete all relations that could be associated with resource
    await Relationship.getInstance().deleteMany({
      subject: {
        $regex: `${subjectResource}.*`,
        $options: 'i',
      },
      resource: {
        $regex: `${objectResource}.*`,
        $options: 'i',
      },
      relation: relation,
    });
  }

  async getRelation(subject: string, relation: string, object: string) {
    checkRelation(subject, relation, object);
    return await Relationship.getInstance().findOne({
      computedTuple: computeRelationTuple(subject, relation, object),
    });
  }

  async findRelations(
    searchQuery: {
      subject?: string;
      relation?: string;
      resource?: string;
      resourceType?: string;
      subjectType?: string;
    },
    skip: number = 0,
    limit = 10,
  ) {
    const query: {
      subject?: string | { $regex: string; $options: string };
      relation?: string;
      resource?: string | { $regex: string; $options: string };
    } = {};
    if (searchQuery.subject) {
      query['subject'] = searchQuery.subject;
    } else if (searchQuery.subjectType) {
      query['subject'] = { $regex: `${searchQuery.subjectType}.*`, $options: 'i' };
    }
    if (searchQuery.relation) {
      query['relation'] = searchQuery.relation;
    }
    if (searchQuery.resource) {
      query['resource'] = searchQuery.resource;
    } else if (searchQuery.resourceType) {
      query['resource'] = { $regex: `${searchQuery.resourceType}.*`, $options: 'i' };
    }
    return Promise.all([
      Relationship.getInstance().findMany(query, undefined, skip, limit),
      Relationship.getInstance().countDocuments(query),
    ]);
  }
}

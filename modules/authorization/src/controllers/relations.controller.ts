import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { checkRelation, computeRelationTuple } from '../utils';
import { Relationship, ResourceDefinition } from '../models';
import { IndexController } from './index.controller';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { Cluster, Redis } from 'ioredis';
import path from 'path';
import { status } from '@grpc/grpc-js';

export class RelationsController {
  private static _instance: RelationsController;
  private indexQueue: Queue;
  private readonly redisConnection: Redis | Cluster;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly indexController: IndexController,
  ) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.indexQueue = new Queue('indexes', {
      connection: this.redisConnection,
    });
  }

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
    if (relationResource) return relationResource;

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
      subjectId: subject.split(':')[1],
      subjectType: subject.split(':')[0],
      relation: relation,
      resource: object,
      resourceId: object.split(':')[1],
      resourceType: object.split(':')[0],
      computedTuple: computeRelationTuple(subject, relation, object),
    });
    await this.indexQueue.add(
      randomUUID(),
      { subject, relation, object },
      {
        removeOnComplete: {
          age: 3600, // keep up to 1 hour
          count: 1000, // keep up to 1000 jobs
        },
        removeOnFail: {
          age: 24 * 3600, // keep up to 24 hours
        },
      },
    );
    const processorFile = path.join(__dirname, 'constructRelationIndexWorker.js');
    new Worker('indexes', processorFile, { connection: this.redisConnection })
      .on('completed', async job => {
        console.log('Job completed: ', job.id);
      })
      .on('failed', async (job, err) => {
        if (job)
          throw new GrpcError(
            status.INTERNAL,
            `${job.id} has failed with ${err.message}`,
          );
      });
    await this.indexQueue.close();
    return relationResource;
  }

  private async checkRelations(subject: string, relation: string, resources: string[]) {
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
    await this.checkRelations(subject, relation, resources);
    const relations = resources.map(r => {
      return {
        subject,
        subjectId: subject.split(':')[1],
        subjectType: subject.split(':')[0],
        relation,
        resource: r,
        resourceId: r.split(':')[1],
        resourceType: r.split(':')[0],
        computedTuple: computeRelationTuple(subject, relation, r),
      };
    });
    const relationDocs = await Relationship.getInstance().createMany(relations);
    const relationEntries = relations.map(r => ({
      subject: r.subject,
      relation: r.relation,
      object: r.resource,
    }));
    await this.indexController.constructRelationIndexes(relationEntries);
    return relationDocs;
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
          subjectType: name,
        },
        { resourceType: name },
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
      subject?: string;
      subjectType?: string;
      relation?: string;
      resource?: string | { $regex: string; $options: string };
      resourceType?: string;
    } = {};
    if (searchQuery.subject) {
      query['subject'] = searchQuery.subject;
    } else if (searchQuery.subjectType) {
      query['subjectType'] = searchQuery.subjectType;
    }
    if (searchQuery.relation) {
      query['relation'] = searchQuery.relation;
    }
    if (searchQuery.resource) {
      query['resource'] = searchQuery.resource;
    } else if (searchQuery.resourceType) {
      query['resourceType'] = searchQuery.resourceType;
    }
    return Promise.all([
      Relationship.getInstance().findMany(query, undefined, skip, limit),
      Relationship.getInstance().countDocuments(query),
    ]);
  }
}

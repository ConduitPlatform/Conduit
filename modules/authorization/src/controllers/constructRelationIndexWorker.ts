import { IndexController } from './index.controller';
import { SandboxedJob } from 'bullmq';

type ConstructRelationIndexWorkerData = {
  subject: string;
  relation: string;
  object: string;
};

module.exports = async (job: SandboxedJob<ConstructRelationIndexWorkerData>) => {
  const { subject, relation, object } = job.data;
  const indexController = await IndexController.getStandaloneInstance(
    process.env.CONDUIT_SERVER,
  );
  await indexController.constructRelationIndex(subject, relation, object);
};

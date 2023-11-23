import { SandboxedJob } from 'bullmq';
import { IndexController } from '../controllers';

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
  return await indexController.constructRelationIndex(subject, relation, object);
};

import { SandboxedJob } from 'bullmq';
import { IndexController } from '../controllers';

type ConstructRelationIndexWorkerData = {
  relations: { subject: string; relation: string; object: string }[];
};

module.exports = async (job: SandboxedJob<ConstructRelationIndexWorkerData>) => {
  const { relations } = job.data;
  const indexController = await IndexController.getStandaloneInstance(
    process.env.CONDUIT_SERVER,
  );
  return await indexController.constructRelationIndexes(relations);
};

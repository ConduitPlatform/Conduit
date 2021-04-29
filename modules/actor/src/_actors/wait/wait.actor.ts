import { WaitInputs } from './wait.interface';
import { ActorInput } from '../../models/actorInput.interface';

export default async function(data: ActorInput<WaitInputs>) {
  let optionsInput = data.actorOptions;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve();
      clearTimeout(timeout);
    }, optionsInput.amount);
  });
}

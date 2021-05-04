import { ActorInput } from '../../models/ActorInput.interface';
import { FunctionInputs } from './function.interface';
import { NodeVM } from 'vm2';
import { ActorResult } from '../../models/ActorResult.interface';

export default async function (data: ActorInput<FunctionInputs>): Promise<ActorResult> {
  let optionsInput = data.actorOptions;
  const vm = new NodeVM({
    console: 'inherit',
    sandbox: {},
  });
  let functionTemplate = `module.exports = function(contextData) { ${optionsInput.code} }`;
  // Sync
  let functionInSandbox = vm.run(functionTemplate);
  let functionData = functionInSandbox(optionsInput.contextData);
  return { data: functionData };
}

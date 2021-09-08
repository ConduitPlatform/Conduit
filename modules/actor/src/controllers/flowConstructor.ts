/**
 * I know the naming sucks don't judge me
 */

import { ActorFlowModel } from '../models';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const PROCESSOR_TEMPLATE = `
{{flow_requirements}}

const deepdash = require('deepdash/standalone');
const _ = require('lodash');

function injectData(injection, actorOptions){
  let replacements = [];
  
  deepdash.eachDeep(actorOptions, (value, key, parent, context) => {
    if (value && typeof value === 'string' && value.indexOf("inject:data") !== -1) {
        replacements.push(context.path);      
    }
  });
  replacements.forEach(replacement=>{
    if(_.has(injection, actorOptions[replacement].replace("inject:", ""))){
      actorOptions[replacement] = _.get(injection, actorOptions[replacement].replace("inject:", ""))
    }
  });  
}

{{flow_auxiliary_code}}


module.exports = async function(job){
  let queueData = {
    data: {trigger: job.data},
    previousNodes: [],
    followingNodes: []
  }
  // if this is not null then the actors execute in order 
  let nextActor = null;
  let executingActor = null;
  try {
    {{flow_code}}
  } catch(e){
    console.error(\"Actor " + executingActor + " crashed with: \" + e);
    throw e;
  }
  return Promise.resolve(queueData);
}
`;

const getActorCode = (actor: {
  code: string;
  comments?: string;
  name: string;
  options: any;
}): string => {
  let actorAlias = actor.name ?? actor.code;

  return `
      if(nextActor === null || nextActor === "${actorAlias}"){
        executingActor = "${actorAlias}";
        nextActor = null;
        let ${actorAlias}Input = {
          actorOptions:  ${JSON.stringify(actor.options)},
          context: {...queueData}
        }
        injectData( {data: queueData.data}, ${actorAlias}Input.actorOptions) 
        let ${actorAlias}Return = await ${actor.code}(${actorAlias}Input);
        if ( ${actorAlias}Return && ${actorAlias}Return.goTo ){
          nextActor = ${actorAlias}Return.goTo;
        } else if ( ${actorAlias}Return ) {      
          queueData.data[\"${actorAlias}\"] = ${actorAlias}Return.data
        }
      }
      `;
};

export default (processorName: string, flowData: ActorFlowModel) => {
  let processorCode = '' + PROCESSOR_TEMPLATE;
  let flowRequirements = '';
  let flowCode = '';
  flowData.actors.forEach((actor) => {
    if (flowRequirements.indexOf(actor.code) === -1) {
      flowRequirements += `const ${actor.code} = require(\'../_actors/${actor.code}/${actor.code}.actor.js\').default\n`;
    }
    flowCode += getActorCode(actor);
  });

  processorCode = processorCode.replace('{{flow_requirements}}', flowRequirements);
  processorCode = processorCode.replace('{{flow_code}}', flowCode);
  mkdirSync(path.resolve(__dirname, `../processors`), { recursive: true });
  writeFileSync(
    path.resolve(__dirname, `../processors/${processorName}.js`),
    processorCode
  );
};

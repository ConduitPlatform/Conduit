import { Query } from 'mongoose';

function populateGroup(groups: any[], newPopulation: string) {
  let compoundPopulation = false;
  if (newPopulation.indexOf('.') !== -1) {
    compoundPopulation = true;
  }
  let foundIndex = -1;
  groups.find((item, index) => {
    if (typeof item === 'string') {
      return newPopulation.indexOf(item) !== -1 ? !(foundIndex = index) && true : false;
    } else {
      return newPopulation.indexOf(item.path) !== -1 ? !(foundIndex = index) && true : false;
    }
  });



  return groups;
}

export function calculatePopulates(queryObj: Query<any>, population: any) {
  let populationGroups: any[] = [];
  population.forEach((r: any) => {
    let final = r.toString();
    if (r.indexOf('.') !== -1) {
      final = '';
      r = r.split('.');
      let controlBool = true;
      while (controlBool) {
        if (this.originalSchema.modelSchema[r[0]]) {
          controlBool = false;
        } else {
          r.splice(0, 1);
        }
      }
      final = r.join('.');
    }
    populationGroups = populateGroup(populationGroups, final);
  });
  queryObj.populate(populationGroups);
  return queryObj;
}

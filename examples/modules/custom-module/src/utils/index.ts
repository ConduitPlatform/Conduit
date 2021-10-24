export function constructSortObj(sort: string[]) {
  let sortObj: any = {};

  if (!Array.isArray(sort)) {
    if ((sort as string).indexOf(',') !== -1) {
      (sort as string).split(',').forEach((sortVal: string) => {
        sortVal = sortVal.trim();
        if (sortVal.indexOf('-') !== -1) {
          sortObj[sortVal.substr(1)] = -1;
        } else {
          sortObj[sortVal] = 1;
        }
      });
    } else {
      if ((sort as string).indexOf('-') !== -1) {
        sortObj[(sort as string).substr(1)] = -1;
      } else {
        sortObj[sort as string] = 1;
      }
    }
  } else {
    sort.forEach((sortVal: string) => {
      sortVal = sortVal.trim();
      if (sortVal.indexOf('-') !== -1) {
        sortObj[sortVal.substr(1)] = -1;
      } else {
        sortObj[sortVal] = 1;
      }
    });
  }
  return sortObj;
}

export function populateArray(pop: any) {
  if (!pop) return pop;
  if (pop.indexOf(',') !== -1) {
    pop = pop.split(',');
  } else if (Array.isArray(pop)) {
    return pop;
  } else {
    pop = [pop];
  }
  return pop;
}

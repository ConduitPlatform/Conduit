export function constructSortObj(sort: string[]) {
  const sortObj: { [field: string]: -1 | 1 } = {};
  sort.forEach((sortVal: string) => {
    sortVal = sortVal.trim();
    if (sortVal.indexOf('-') !== -1) {
      sortObj[sortVal.substring(1)] = -1;
    } else {
      sortObj[sortVal] = 1;
    }
  });
  return sortObj;
}

export function parseSortParam(sort: string) {
  return constructSortObj(sort.split(' '));
}

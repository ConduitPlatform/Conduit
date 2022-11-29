export function constructSortObj(sort: string[]) {
  const sortObj: { [key: string]: number } = {};
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

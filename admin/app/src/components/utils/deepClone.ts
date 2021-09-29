export const deepClone: any = (o: any) => {
  let newO, i;

  if (typeof o !== 'object') {
    return o;
  }
  if (!o) {
    return o;
  }

  if ('[object Array]' === Object.prototype.toString.apply(o)) {
    newO = [];
    for (i = 0; i < o.length; i += 1) {
      newO[i] = deepClone(o[i]);
    }
    return newO;
  }

  newO = {} as any;
  for (i in o) {
    if (o.hasOwnProperty(i)) {
      newO[i] = deepClone(o[i]);
    }
  }
  return newO;
};

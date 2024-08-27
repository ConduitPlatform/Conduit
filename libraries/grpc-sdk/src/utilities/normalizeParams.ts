export function normalizeParams(givenParams: any[], fnParamKeys: string[]) {
  if (givenParams.length === 1 && typeof givenParams[0] === 'object') {
    return givenParams[0];
  }
  const normalizedObj: any = {};
  fnParamKeys.forEach((key, index) => {
    normalizedObj[key] = givenParams[index];
  });
  return normalizedObj;
}

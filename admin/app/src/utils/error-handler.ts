export const getErrorData = (errorProp: any) => {
  if (!errorProp) {
    return;
  }

  const { details } = errorProp.data;
  const { error, status } = errorProp;

  const detailsFound = details !== '' && details !== null && details !== undefined;
  const errorFound = error !== '' && error !== null && error !== undefined;
  const statusFound = status !== '' && status !== null && status !== undefined;

  if (!detailsFound && !errorFound && !statusFound) {
    return 'An unexpected error happened!';
  } else return `${detailsFound ? details : ''} ${errorFound ? error : ''} ${statusFound ? status : ''}`;
};

export const getErrorData = (errorProp) => {
  if (!errorProp) {
    return;
  }
  const { data = { error: '' } } = errorProp ? errorProp.data : {};
  const { error = '' } = data ? data : {};
  const { status = null, statusText = '' } = errorProp ? errorProp : {};

  return {
    message: error,
    status: status,
    statusText: statusText,
  };
};

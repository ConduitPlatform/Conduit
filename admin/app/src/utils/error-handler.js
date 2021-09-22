export const getErrorData = (error) => {
  if (!error) {
    return;
  }
  return {
    message: error.data.error,
    status: error.status,
    statusText: error.statusText,
  };
};

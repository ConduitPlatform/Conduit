export const getErrorData = (error) => {
  if (!error) {
    return;
  }
  if (error === 'none') {
    return {
      message: '',
      status: null,
      statusText: '',
    };
  }
  return {
    message: error.data.error,
    status: error.status,
    statusText: error.statusText,
  };
};

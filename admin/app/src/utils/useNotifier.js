import { useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { enqueueSnackbar, removeSnackbar } from '../redux/slices/appSlice';

const useNotifier = () => {
  const dispatch = useAppDispatch();
  const { notifications } = useAppSelector((state) => state.appSlice || []);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    notifications.forEach(({ key, message }) => {
      enqueueSnackbar(message, { key });
      dispatch(removeSnackbar(key));
    });
  }, [dispatch, enqueueSnackbar, notifications]);
};

export default useNotifier;

export const enqueueErrorNotification = (message) => {
  const options = { variant: 'error', message: message ? message : 'Something went wrong' };
  return enqueueSnackbar({
    message: JSON.stringify(options),
    options: {
      key: new Date().getTime() + Math.random(),
      variant: 'error',
      autoHideDuration: 3000,
    },
  });
};

export const enqueueInfoNotification = (message) => {
  const options = { variant: 'info', message: message ? message : 'Info' };
  return enqueueSnackbar({
    message: JSON.stringify(options),
    options: {
      key: new Date().getTime() + Math.random(),
      variant: 'info',
      autoHideDuration: 3000,
    },
  });
};

export const enqueueSuccessNotification = (message) => {
  const options = { variant: 'success', message: message ? message : 'Success' };
  return enqueueSnackbar({
    message: JSON.stringify(options),
    options: {
      key: new Date().getTime() + Math.random(),
      variant: 'success',
      autoHideDuration: 3000,
    },
  });
};

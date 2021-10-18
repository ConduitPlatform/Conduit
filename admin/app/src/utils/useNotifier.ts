import { useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { addSnackbar, removeSnackbar } from '../redux/slices/appSlice';
import { v4 as uuidv4 } from 'uuid';

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

export const enqueueErrorNotification = (message: string) => {
  const options = { variant: 'error', message: message ? message : 'Something went wrong' };
  return addSnackbar({
    message: JSON.stringify(options),
    options: {
      key: uuidv4(),
      variant: 'error',
      autoHideDuration: 3000,
    },
  });
};

export const enqueueInfoNotification = (message: string) => {
  const options = { variant: 'info', message: message ? message : 'Info' };
  return addSnackbar({
    message: JSON.stringify(options),
    options: {
      key: uuidv4(),
      variant: 'info',
      autoHideDuration: 3000,
    },
  });
};

export const enqueueSuccessNotification = (message: string) => {
  const options = { variant: 'success', message: message ? message : 'Success' };
  return addSnackbar({
    message: JSON.stringify(options),
    options: {
      key: uuidv4(),
      variant: 'success',
      autoHideDuration: 3000,
    },
  });
};

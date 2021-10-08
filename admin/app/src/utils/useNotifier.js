import { useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { enqueueSnackbar, removeSnackbar } from '../redux/slices/appSlice';

let displayed = [];

const useNotifier = () => {
  const dispatch = useAppDispatch();
  const { notifications } = useAppSelector((state) => state.appSlice || []);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const storeDisplayed = (id) => {
    displayed = [...displayed, id];
  };

  const removeDisplayed = (id) => {
    displayed = [...displayed.filter((key) => id !== key)];
  };

  useEffect(() => {
    notifications.forEach(({ key, message, options = {}, dismissed = false }) => {
      if (dismissed) {
        // dismiss snackbar using notistack
        closeSnackbar(key);
        return;
      }

      // do nothing if snackbar is already displayed
      if (displayed.includes(key)) return;

      // display snackbar using notistack
      enqueueSnackbar(message, {
        key,
        ...options,
        onClose: (event, reason, myKey) => {
          if (options.onClose) {
            options.onClose(event, reason, myKey);
          }
        },
        onExited: (event, myKey) => {
          // remove this snackbar from redux store
          dispatch(removeSnackbar(myKey));
          removeDisplayed(myKey);
        },
      });

      // keep track of snackbars that we've displayed
      storeDisplayed(key);
    });
  }, [notifications, closeSnackbar, enqueueSnackbar, dispatch]);
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

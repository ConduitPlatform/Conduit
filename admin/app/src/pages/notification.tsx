import React, { SyntheticEvent, useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { privateRoute } from '../components/utils/privateRoute';
import CustomTabs from '../components/common/CustomTabs';
import DataTable from '../components/common/DataTable';
import SendNotificationForm from '../components/notifications/SendNotificationForm';
import NotificationSettings from '../components/notifications/NotificationSettings';
import Snackbar from '@material-ui/core/Snackbar';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import {
  INotificationSettings,
  NotificationData,
} from '../models/notifications/NotificationModels';
import {
  asyncGetNotificationConfig,
  asyncSaveNotificationConfig,
  asyncSendNewNotification,
} from '../redux/slices/notificationsSlice';
import { useAppDispatch, useAppSelector } from '../redux/store';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

const Notification: React.FC = () => {
  const dispatch = useAppDispatch();
  const classes = useStyles();

  const { config, notifications } = useAppSelector(
    (state) => state.notificationsSlice.data
  );
  const { loading, error } = useAppSelector((state) => state.notificationsSlice.meta);
  const [selected, setSelected] = useState(0);
  const [moduleDisabled, setModuleDisabled] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    dispatch(asyncGetNotificationConfig());
  }, [dispatch]);

  useEffect(() => {
    if (config) {
      if (config.message !== '') {
        setModuleDisabled(true);
      } else {
        setModuleDisabled(false);
        setSelected(0);
      }
    }
  }, [config]);

  useEffect(() => {
    if (error) {
      setSnackbarOpen(true);
    }
  }, [error]);

  const tabs = [
    { title: 'Notifications' },
    { title: 'Send Notifications' },
    { title: 'Settings' },
  ];

  const snackbarAlert = () => {
    if (error) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          {error ? error : 'Something went wrong!'}
        </Alert>
      );
    } else {
      return undefined;
    }
  };

  const handleClose = (event: SyntheticEvent) => {
    setSnackbarOpen(false);
  };
  const handleChange = (event: SyntheticEvent, newValue: number) => {
    setSelected(newValue);
  };

  const sendNotification = (data: NotificationData) => {
    dispatch(asyncSendNewNotification(data));
  };

  const handleConfigSave = (data: INotificationSettings) => {
    dispatch(asyncSaveNotificationConfig(data));
  };

  return (
    <>
      <Box p={2}>
        <Typography variant={'h4'}>Push Notifications</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        {moduleDisabled && (
          <Box>
            <Typography variant={'h6'}>This module is not available</Typography>
          </Box>
        )}
        {!moduleDisabled && (
          <>
            <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
              {notifications ? (
                <DataTable dsData={notifications} />
              ) : (
                <Typography variant={'h6'}>No data available</Typography>
              )}
            </Box>
            <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
              <SendNotificationForm handleSend={sendNotification} />
            </Box>
            <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
              <NotificationSettings
                handleSave={handleConfigSave}
                config={config ? config : null}
              />
            </Box>
          </>
        )}
      </Box>
      <Snackbar
        open={snackbarOpen}
        className={classes.snackBar}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbarAlert()}
      </Snackbar>
      <Backdrop open={loading} className={classes.backdrop}>
        <CircularProgress color="secondary" />
      </Backdrop>
    </>
  );
};

export default privateRoute(Notification);

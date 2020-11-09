import React, { useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { privateRoute } from '../components/utils/privateRoute';
import { Layout } from '../components/navigation/Layout';
import CustomTabs from '../components/common/CustomTabs';
import DataTable from '../components/common/DataTable';
import SendNotificationForm from '../components/notifications/SendNotificationForm';
import NotificationSettings from '../components/notifications/NotificationSettings';
import { useDispatch, useSelector } from 'react-redux';
import {
  getConfig,
  saveConfig,
  sendNewNotification,
} from '../redux/thunks/notificationThunks';
import Snackbar from '@material-ui/core/Snackbar';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

const Notification = () => {
  const tabs = [
    { title: 'Notifications' },
    { title: 'Send Notifications' },
    { title: 'Settings' },
  ];
  const dispatch = useDispatch();
  const classes = useStyles();

  const { data, loading, error } = useSelector((state) => state.notificationReducer);

  const [selected, setSelected] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    dispatch(getConfig());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      setSnackbarOpen(true);
    }
  }, [error]);

  const snackbarAlert = () => {
    if (error) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          {error?.data?.error ? error.data.error : 'Something went wrong!'}
        </Alert>
      );
    } else {
      return undefined;
    }
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };
  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  const sendNotification = (notificationData) => {
    const data = {
      userId: notificationData.userId,
      title: notificationData.title,
      data: notificationData.data,
      body: notificationData.body,
    };
    dispatch(sendNewNotification(data));
  };

  const handleConfigSave = (data) => {
    dispatch(saveConfig(data));
  };

  return (
    <Layout itemSelected={2}>
      <Box p={2}>
        <Typography variant={'h4'}>Push Notifications</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          {data && data.notifications ? (
            <DataTable dsData={data.notifications} />
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
            config={data ? data.config : null}
          />
        </Box>
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
    </Layout>
  );
};

export default privateRoute(Notification);

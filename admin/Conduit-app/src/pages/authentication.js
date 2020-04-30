import React, { useEffect, useState } from 'react';
import AuthAccordion from '../components/AuthAccordion';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { Layout } from '../components/Layout';
import CustomTabs from '../components/CustomTabs';
import { privateRoute } from '../components/utils/privateRoute';
import AuthUsers from '../components/AuthUsers';
import { useDispatch, useSelector } from 'react-redux';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import { getAuthUsersData, getConfig, updateConfig } from '../redux/thunks/authenticationThunks';
import AuthSettings from '../components/AuthSettings';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
}));

const Authentication = () => {
  const classes = useStyles();
  const { users, error: authUsersError, loading: usersLoading } = useSelector(
    (state) => state.authenticationPageReducer.authUsersState
  );
  const { data: configData, error: authConfigError, loading: configLoading } = useSelector(
    (state) => state.authenticationPageReducer.signInMethodsState
  );
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const tabs = [
    { title: 'Users', isDisabled: configData ? !configData.active : true },
    { title: 'Sign-In Method', isDisabled: configData ? !configData.active : true },
    { title: 'Settings', isDisabled: false },
  ];

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getAuthUsersData());
  }, []);

  useEffect(() => {
    dispatch(getConfig());
  }, []);

  useEffect(() => {
    if (configData && !configData.active) {
      setSelected(2);
    }
  }, [configData]);

  useEffect(() => {
    if (authUsersError || authConfigError) {
      setSnackbarOpen(true);
    }
  }, [authUsersError, authConfigError]);

  const [selected, setSelected] = useState(0);

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  const handleConfigChange = (type, newValue) => {
    const data = {
      [type]: {
        ...newValue,
      },
    };
    dispatch(updateConfig(data));
  };

  const snackbarAlert = () => {
    if (authUsersError || authConfigError) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          Something went wrong!
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

  const handleSettingsSave = (data) => {
    dispatch(updateConfig(data));
  };

  return (
    <Layout itemSelected={1}>
      <Box p={2}>
        <Typography variant={'h4'}>Authentication</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0 || (configData && !configData.active)} id={`tabpanel-0`}>
          {users ? <AuthUsers users={users} /> : <Typography>No users available</Typography>}
        </Box>
        <Box role="tabpanel" hidden={selected !== 1 || (configData && !configData.active)} id={`tabpanel-1`}>
          {configData ? (
            <AuthAccordion configData={configData} configDataError={authConfigError} handleData={handleConfigChange} />
          ) : (
            <Typography>No config available</Typography>
          )}
        </Box>
        <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
          <AuthSettings handleSave={handleSettingsSave} settingsData={configData} error={authConfigError} />
        </Box>
      </Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbarAlert()}
      </Snackbar>
      <Backdrop open={usersLoading || configLoading} className={classes.backdrop}>
        <CircularProgress color="secondary" />
      </Backdrop>
    </Layout>
  );
};

export default privateRoute(Authentication);

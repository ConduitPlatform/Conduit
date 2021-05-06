import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AuthAccordion from '../components/authentication/AuthAccordion';
import AuthSettings from '../components/authentication/AuthSettings';
import AuthUsers from '../components/authentication/AuthUsers';
import CustomTabs from '../components/common/CustomTabs';
import { Layout } from '../components/navigation/Layout';
import { privateRoute } from '../components/utils/privateRoute';
import {
  getAuthUsersData,
  getConfig,
  updateConfig,
} from '../redux/thunks/authenticationThunks';
import ServiceAccountsTabs from '../components/authentication/ServiceAccountsTabs';
import AppState from '../components/common/AppState';

const Authentication = () => {
  const dispatch = useDispatch();

  const [selected, setSelected] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const {
    users: availableUsers,
    error: authUsersError,
    loading: usersLoading,
  } = useSelector((state) => state.authenticationPageReducer.authUsersState);

  const {
    data: configData,
    error: authConfigError,
    loading: configLoading,
  } = useSelector((state) => state.authenticationPageReducer.signInMethodsState);

  useEffect(() => {
    dispatch(getAuthUsersData());
    dispatch(getConfig());
  }, [dispatch]);

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

  const tabs = [
    { title: 'Users', isDisabled: configData ? !configData.active : true },
    { title: 'Sign-In Method', isDisabled: configData ? !configData.active : true },
    { title: 'Service Accounts', isDisabled: false },
    { title: 'Settings', isDisabled: false },
  ];

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  const handleConfigChange = (type, newValue) => {
    const data = {
      ...configData,
      [type]: {
        ...newValue,
      },
    };
    dispatch(updateConfig(data));
  };

  const alertMessage = () => {
    if (authUsersError) {
      return authUsersError.data?.error
        ? authUsersError.data.error
        : 'Something went wrong!';
    }
    if (authConfigError) {
      return authConfigError.data?.error
        ? authConfigError.data.error
        : 'Something went wrong!';
    }
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleSettingsSave = (data) => {
    const body = {
      ...configData,
      ...data,
    };
    dispatch(updateConfig(body));
  };

  return (
    <Layout itemSelected={1}>
      <Box p={2}>
        <Typography variant={'h4'}>Authentication</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box
          role="tabpanel"
          hidden={selected !== 0 || (configData && !configData.active)}
          id={`tabpanel-0`}>
          {availableUsers ? (
            <AuthUsers users={availableUsers} />
          ) : (
            <Typography>No users available</Typography>
          )}
        </Box>
        <Box
          role="tabpanel"
          hidden={selected !== 1 || (configData && !configData.active)}
          id={`tabpanel-1`}>
          {configData ? (
            <AuthAccordion
              configData={configData}
              configDataError={authConfigError}
              handleData={handleConfigChange}
            />
          ) : (
            <Typography>No config available</Typography>
          )}
        </Box>
        <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
          <ServiceAccountsTabs />
        </Box>
        <Box role="tabpanel" hidden={selected !== 3} id={`tabpanel-3`}>
          <AuthSettings
            handleSave={handleSettingsSave}
            settingsData={configData}
            error={authConfigError}
          />
        </Box>
      </Box>
      <AppState
        message={alertMessage()}
        loading={usersLoading || configLoading}
        snackbarOpen={snackbarOpen}
        handleClose={handleClose}
      />
    </Layout>
  );
};

export default privateRoute(Authentication);

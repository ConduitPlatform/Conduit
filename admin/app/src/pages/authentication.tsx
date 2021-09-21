import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import React, { useEffect, useState } from 'react';
import AuthAccordion from '../components/authentication/AuthAccordion';
import NewUserModal from '../components/authentication/NewUserModal';
import AuthSettings from '../components/authentication/AuthSettings';
import AuthUsers from '../components/authentication/AuthUsers';
import CustomTabs from '../components/common/CustomTabs';
import Paginator from '../components/common/Paginator';
import SearchFilter from '../components/authentication/SearchFilter';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import { Layout } from '../components/navigation/Layout';
import { privateRoute } from '../components/utils/privateRoute';
import ServiceAccountsTabs from '../components/authentication/ServiceAccountsTabs';
import AppState from '../components/common/AppState';
import useDebounce from '../hooks/useDebounce';
import {
  SettingsStateTypes,
  SocialDataTypes,
  SocialNameTypes,
} from '../models/authentication/AuthModels';
import { SnackbarCloseReason } from '@material-ui/core/Snackbar/Snackbar';
import {
  asyncAddNewUser,
  asyncGetAuthenticationConfig,
  asyncGetAuthUserData,
  asyncUpdateAuthenticationConfig,
} from '../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../redux/store';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(0.5),
    },
    marginBottom: '3px',
  },
}));

const Authentication = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<number>(0);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [filter, setFilter] = useState('none');
  const debouncedSearch: string = useDebounce(search, 500);

  const { users } = useAppSelector((state) => state.authenticationSlice.data.authUsers);
  const { error: authError, success: authSuccess } = useAppSelector(
    (state) => state.authenticationSlice.meta.authUsers
  );

  const { signInMethods: configData } = useAppSelector(
    (state) => state.authenticationSlice.data
  );
  const { error: authConfigError } = useAppSelector(
    (state) => state.authenticationSlice.meta.signInMethods
  );

  const handleFilterChange = (
    event: React.ChangeEvent<{ name?: string; value: any }>
  ) => {
    setFilter(event.target.value);
  };

  useEffect(() => {
    dispatch(asyncGetAuthenticationConfig());
  }, [dispatch]);

  useEffect(() => {
    dispatch(asyncGetAuthUserData({ skip, limit, search: debouncedSearch, filter }));
  }, [dispatch, filter, limit, skip, debouncedSearch]);

  useEffect(() => {
    if (configData && !configData.active) {
      setSelected(2);
    }
  }, [configData]);

  useEffect(() => {
    if (authError || authConfigError || authSuccess) {
      setSnackbarOpen(true);
    }
  }, [authError, authConfigError, authSuccess]);

  const tabs = [
    { title: 'Users', isDisabled: configData ? !configData.active : true },
    { title: 'Sign-In Method', isDisabled: configData ? !configData.active : true },
    { title: 'Service Accounts', isDisabled: false },
    { title: 'Settings', isDisabled: false },
  ];

  const handleLimitChange = (e: any) => {
    setLimit(parseInt(e.target.value, 10));
    setSkip(0);
    setPage(0);
  };

  const handlePageChange = (e: any, val: number) => {
    if (val > page) {
      setPage(page + 1);
      setSkip(skip + limit);
    } else {
      setPage(page - 1);
      setSkip(skip - limit);
    }
  };

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
  };

  const handleConfigChange = (type: SocialNameTypes, newValue: SocialDataTypes) => {
    const data = {
      ...configData,
      [type]: {
        ...newValue,
      },
    };
    dispatch(asyncUpdateAuthenticationConfig(data));
  };

  const alertMessage = () => {
    if (authError) {
      return authError ? authError : 'Something went wrong!';
    }
    if (authConfigError) {
      return authConfigError ? authConfigError : 'Something went wrong!';
    }
  };

  const successMessage = () => {
    if (authSuccess) {
      return authSuccess;
    }
  };

  const handleClose = (event: React.SyntheticEvent<any>, reason: SnackbarCloseReason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleNewUserDispatch = (values: { password: string; email: string }) => {
    dispatch(asyncAddNewUser({ values, limit }));
    setSkip(0);
    setPage(0);
    setSearch('');
    setFilter('none');
  };

  const handleSettingsSave = (data: SettingsStateTypes) => {
    const body = {
      ...configData,
      ...data,
    };
    dispatch(asyncUpdateAuthenticationConfig(body));
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
          <Paper variant="outlined" className={classes.root}>
            <Grid container>
              <Grid item xs={6}>
                <SearchFilter
                  setSearch={setSearch}
                  search={search}
                  filter={filter}
                  handleFilterChange={handleFilterChange}
                />
              </Grid>
              <Grid item xs={6}>
                <Paginator
                  handlePageChange={handlePageChange}
                  // skip={skip}
                  limit={limit}
                  handleLimitChange={handleLimitChange}
                  page={page}
                />
              </Grid>
            </Grid>
          </Paper>

          {users ? (
            <AuthUsers users={users} />
          ) : (
            <Typography>No users available</Typography>
          )}

          <NewUserModal
            handleNewUserDispatch={handleNewUserDispatch}
            // page={skip}
            // limit={limit}
          />
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
        successMessage={successMessage()}
        errorMessage={alertMessage()}
        snackbarOpen={snackbarOpen}
        handleClose={handleClose}
      />
    </Layout>
  );
};

export default privateRoute(Authentication);

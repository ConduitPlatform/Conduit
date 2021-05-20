import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
import {
  addNewUserThunk,
  getAuthUsersData,
  getConfig,
  updateConfig,
} from '../redux/thunks/authenticationThunks';
import ServiceAccountsTabs from '../components/authentication/ServiceAccountsTabs';
import Debounce from '../components/common/Debounce';
import AppState from '../components/common/AppState';

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
  const dispatch = useDispatch();

  const [page, setPage] = useState(0);
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [filter, setFilter] = useState({ filterValue: 'none' });

  const {
    users: availableUsers,
    error: authUsersError,
    success: authUsersSuccess,
    loading: usersLoading,
  } = useSelector((state) => state.authenticationPageReducer.authUsersState);

  const {
    data: configData,
    error: authConfigError,
    loading: configLoading,
  } = useSelector((state) => state.authenticationPageReducer.signInMethodsState);

  const handleFilterChange = (event) => {
    const name = event.target.name;
    setFilter({
      ...filter,
      [name]: event.target.value,
    });
  };

  useEffect(() => {
    if (search === '' && filter.filterValue === 'none') {
      dispatch(getAuthUsersData(skip, limit, search, filter));
      dispatch(getConfig());
    }
  }, [dispatch, search, filter, skip, limit]);

  useEffect(() => {
    if (search !== '' || filter.filterValue !== 'none') {
      debouncedSearch(search);
    }
  }, [search, filter, skip, limit]);

  const debouncedSearch = useCallback(
    Debounce((search) => {
      dispatch(getAuthUsersData(skip, limit, search, filter));
    }, 300),
    [search, filter, skip, limit]
  );

  useEffect(() => {
    if (configData && !configData.active) {
      setSelected(2);
    }
  }, [configData]);

  useEffect(() => {
    if (authUsersError || authConfigError || authUsersSuccess) {
      setSnackbarOpen(true);
    }
  }, [authUsersError, authConfigError, authUsersSuccess]);

  const tabs = [
    { title: 'Users', isDisabled: configData ? !configData.active : true },
    { title: 'Sign-In Method', isDisabled: configData ? !configData.active : true },
    { title: 'Service Accounts', isDisabled: false },
    { title: 'Settings', isDisabled: false },
  ];

  const handleLimitChange = (e, value) => {
    setLimit(parseInt(e.target.value, 10));
    setSkip(0);
    setPage(0);
  };

  const handlePageChange = (e, val) => {
    if (val > page) {
      setPage(page + 1);
      setSkip(skip + limit);
    } else {
      setPage(page - 1);
      setSkip(skip - limit);
    }
  };

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

  const successMessage = () => {
    if (authUsersSuccess) {
      return authUsersSuccess;
    }
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleNewUserDispatch = (values) => {
    dispatch(addNewUserThunk(values, availableUsers, limit));
    setSkip(0);
    setPage(0);
    setSearch('');
    setFilter({ filterValue: 'none' });
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
                  skip={skip}
                  limit={limit}
                  handleLimitChange={handleLimitChange}
                  page={page}
                />
              </Grid>
            </Grid>
          </Paper>

          {availableUsers ? (
            <AuthUsers users={availableUsers} />
          ) : (
            <Typography>No users available</Typography>
          )}

          <NewUserModal
            handleNewUserDispatch={handleNewUserDispatch}
            page={skip}
            limit={limit}
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
        loading={usersLoading || configLoading}
        snackbarOpen={snackbarOpen}
        handleClose={handleClose}
      />
    </Layout>
  );
};

export default privateRoute(Authentication);

import Typography from '@material-ui/core/Typography';
import React, { ReactElement, useEffect, useState } from 'react';
import NewUserModal from '../../components/authentication/NewUserModal';
import AuthUsers from '../../components/authentication/AuthUsers';
import Paginator from '../../components/common/Paginator';
import SearchFilter from '../../components/authentication/SearchFilter';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import useDebounce from '../../hooks/useDebounce';
import {
  asyncAddNewUser,
  asyncGetAuthenticationConfig,
  asyncGetAuthUserData,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import AuthenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(0.5),
    },
    marginBottom: '3px',
  },
}));

const Users = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { users } = useAppSelector((state) => state.authenticationSlice.data.authUsers);
  const { signInMethods: configData } = useAppSelector((state) => state.authenticationSlice.data);

  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<number>(0);
  const [filter, setFilter] = useState('none');

  const debouncedSearch: string = useDebounce(search, 500);

  const handleFilterChange = (event: React.ChangeEvent<{ name?: string; value: any }>) => {
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

  const handleNewUserDispatch = (values: { password: string; email: string }) => {
    dispatch(asyncAddNewUser({ values, limit }));
    setSkip(0);
    setPage(0);
    setSearch('');
    setFilter('none');
  };

  return (
    <div>
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
              limit={limit}
              handleLimitChange={handleLimitChange}
              page={page}
            />
          </Grid>
        </Grid>
      </Paper>

      {users ? <AuthUsers users={users} /> : <Typography>No users available</Typography>}

      <NewUserModal handleNewUserDispatch={handleNewUserDispatch} />
    </div>
  );
};

Users.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticationLayout>{page}</AuthenticationLayout>;
};

export default Users;

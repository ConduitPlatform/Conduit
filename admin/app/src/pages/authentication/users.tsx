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
  asyncBlockUserUI,
  asyncDeleteUser,
  asyncGetAuthenticationConfig,
  asyncGetAuthUserData,
  asyncUnblockUserUI,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import AuthenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { AuthUser, AuthUserUI } from '../../models/authentication/AuthModels';
import EditUserDialog from '../../components/authentication/EditUserDialog';

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

  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState('none');
  const [selectedUser, setSelectedUser] = useState<AuthUser>({
    active: false,
    createdAt: '',
    email: '',
    isVerified: false,
    phoneNumber: '',
    updatedAt: '',
    _id: '',
  });
  const [selectedUsersHaveUser, setSelectedUsersHaveUser] = useState<boolean>(false);
  const [openBlockUI, setOpenBlockUI] = useState<boolean>(false);
  const [openDeleteUser, setOpenDeleteUser] = useState<boolean>(false);
  const [openEditUser, setOpenEditUser] = useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

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

  const handleSelect = (id: string) => {
    const newSelectedUsers = [...selectedUsers];
    if (selectedUsers.includes(id)) {
      const index = newSelectedUsers.findIndex((newId) => newId === id);
      newSelectedUsers.splice(index, 1);
    } else {
      newSelectedUsers.push(id);
    }
    setSelectedUsers(newSelectedUsers);
  };

  const handleSelectAll = (data: any) => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
      return;
    }
    const newSelectedUsers = data.map((item: any) => item._id);
    setSelectedUsers(newSelectedUsers);
  };

  const handleAction = (action: { title: string; type: string }, data: AuthUserUI) => {
    const currentUser = users.find((user) => user._id === data._id) as AuthUser;
    if (action.type === 'edit') {
      setOpenEditUser(true);
      setSelectedUser(currentUser);
    } else if (action.type === 'delete') {
      setOpenDeleteUser(true);
      setSelectedUser(currentUser);
    } else if (action.type === 'block/unblock') {
      setOpenBlockUI(true);
      setSelectedUser(currentUser);
    }
  };

  const handleBlockTitle = () => {
    if (selectedUsersHaveUser) {
      return 'Toggle selected users';
    }
    return selectedUser.active ? 'User is Unblocked' : 'User is Blocked';
  };

  const handleBlockDescription = () => {
    if (selectedUsersHaveUser) {
      return 'Are you sure you want to block/unblock the selected users?';
    }
    return selectedUser.active
      ? `Are you sure you want to block ${selectedUser.email}`
      : `Are you sure you want to unblock ${selectedUser.email}`;
  };

  const handleBlockButton = () => {
    if (selectedUsersHaveUser) {
      return 'Toggle';
    }
    return selectedUser.active ? 'Block' : 'Unblock';
  };

  const handleBlock = () => {
    if (selectedUsersHaveUser) {
      // const body = {
      //   ids: selectedUsers,
      //   block: true,
      // };
      // const block = selectedUsers.some;
      //
      // return;
      // dispatch(asyncblockUnblockUsers(body));
      // return;
    }
    if (selectedUser.active) {
      dispatch(asyncBlockUserUI(selectedUser._id));
      setOpenBlockUI(false);
    } else {
      dispatch(asyncUnblockUserUI(selectedUser._id));
      setOpenBlockUI(false);
    }
  };

  const handleClose = () => {
    setOpenDeleteUser(false);
    setOpenEditUser(false);
    setOpenBlockUI(false);
  };

  const deleteButtonAction = (id: string) => {
    dispatch(asyncDeleteUser(id));
    setOpenDeleteUser(false);
  };

  const handleDeleteTitle = () => {
    if (selectedUsersHaveUser) {
      return 'Delete selected users';
    }
    return `Delete user ${selectedUser.email}`;
  };

  const handleDeleteDescription = () => {
    if (selectedUsersHaveUser) {
      return 'Are you sure you want to delete the selected users?';
    }
    return `Are you sure you want to delete ${selectedUser.email}? 
    \ Active: ${selectedUser.active}
    \ Verified: ${selectedUser.isVerified}`;
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

      {users && users.length > 0 ? (
        <AuthUsers
          users={users}
          handleAction={handleAction}
          handleSelect={handleSelect}
          handleSelectAll={handleSelectAll}
          selectedUsers={selectedUsers}
        />
      ) : (
        <Typography>No users available</Typography>
      )}

      <NewUserModal handleNewUserDispatch={handleNewUserDispatch} />
      <ConfirmationDialog
        open={openDeleteUser}
        handleClose={handleClose}
        title={handleDeleteTitle()}
        description={handleDeleteDescription()}
        buttonAction={() => deleteButtonAction(selectedUser._id)}
        buttonText={'Delete'}
      />
      <ConfirmationDialog
        open={openBlockUI}
        handleClose={handleClose}
        title={handleBlockTitle()}
        description={handleBlockDescription()}
        buttonAction={handleBlock}
        buttonText={handleBlockButton()}
      />
      <EditUserDialog open={openEditUser} data={selectedUser} handleClose={handleClose} />
    </div>
  );
};

Users.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticationLayout>{page}</AuthenticationLayout>;
};

export default Users;

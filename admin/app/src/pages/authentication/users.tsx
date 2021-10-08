import Typography from '@material-ui/core/Typography';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import NewUserModal from '../../components/authentication/NewUserModal';
import AuthUsers from '../../components/authentication/AuthUsers';
import Paginator from '../../components/common/Paginator';
import SearchFilter from '../../components/authentication/SearchFilter';
import Grid from '@material-ui/core/Grid';
import { Button, makeStyles } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import useDebounce from '../../hooks/useDebounce';
import {
  asyncAddNewUser,
  asyncBlockUnblockUsers,
  asyncBlockUserUI,
  asyncDeleteUser,
  asyncDeleteUsers,
  asyncGetAuthenticationConfig,
  asyncGetAuthUserData,
  asyncUnblockUserUI,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import AuthenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { AuthUser, AuthUserUI } from '../../models/authentication/AuthModels';
import EditUserDialog from '../../components/authentication/EditUserDialog';
import {
  handleBlockButton,
  handleBlockDescription,
  handleBlockTitle,
  handleDeleteDescription,
  handleDeleteTitle,
} from '../../components/utils/userDialog';
import DeleteIcon from '@material-ui/icons/Delete';
import BlockIcon from '@material-ui/icons/Block';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(0.5),
    },
    marginBottom: '3px',
  },
  groupActionButton: {
    padding: 0,
    height: 24,
  },
  groupActionContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    alignItems: 'start',
  },
  groupActionButtonIcon: {
    marginRight: 8,
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
  const [openBlockUI, setOpenBlockUI] = useState<{ open: boolean; multiple: boolean }>({
    open: false,
    multiple: false,
  });
  const [openDeleteUser, setOpenDeleteUser] = useState<{ open: boolean; multiple: boolean }>({
    open: false,
    multiple: false,
  });
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
    setLimit(e.target.value);
    setSkip(0);
    setPage(0);
  };

  const handlePageChange = (event: React.MouseEvent<HTMLButtonElement> | null, val: number) => {
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

  const handleSelectAll = (data: AuthUserUI[]) => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
      return;
    }
    const newSelectedUsers = data.map((item: AuthUserUI) => item._id);
    setSelectedUsers(newSelectedUsers);
  };

  const handleAction = (action: { title: string; type: string }, data: AuthUserUI) => {
    const currentUser = users.find((user) => user._id === data._id) as AuthUser;
    if (action.type === 'edit') {
      setOpenEditUser(true);
      setSelectedUser(currentUser);
    } else if (action.type === 'delete') {
      setOpenDeleteUser({
        open: true,
        multiple: false,
      });
      setSelectedUser(currentUser);
    } else if (action.type === 'block/unblock') {
      setOpenBlockUI({
        open: true,
        multiple: false,
      });
      setSelectedUser(currentUser);
    }
  };

  const getUsersCallback = useCallback(() => {
    dispatch(asyncGetAuthUserData({ skip, limit, search: debouncedSearch, filter }));
  }, [debouncedSearch, dispatch, filter, limit, skip]);

  const handleBlock = () => {
    if (openBlockUI.multiple) {
      const selectedUsersObj: boolean[] = [];
      users.forEach((user) => {
        if (selectedUsers.includes(user._id)) {
          selectedUsersObj.push(user.active);
        }
      });
      const isActive = selectedUsersObj.some((active) => active);
      const params = {
        body: {
          ids: selectedUsers,
          block: !isActive,
        },
        getUsers: getUsersCallback,
      };
      dispatch(asyncBlockUnblockUsers(params));
      setOpenBlockUI({
        open: false,
        multiple: false,
      });
      return;
    }
    if (selectedUser.active) {
      dispatch(asyncBlockUserUI(selectedUser._id));
    } else {
      dispatch(asyncUnblockUserUI(selectedUser._id));
    }
    setOpenBlockUI({
      open: false,
      multiple: false,
    });
  };

  const handleClose = () => {
    setOpenDeleteUser({
      open: false,
      multiple: false,
    });
    setOpenBlockUI({
      open: false,
      multiple: false,
    });
    setOpenEditUser(false);
  };

  const deleteButtonAction = () => {
    if (openDeleteUser.open) {
      const params = {
        ids: selectedUsers,
        getUsers: getUsersCallback,
      };
      dispatch(asyncDeleteUsers(params));
    } else {
      const params = {
        id: selectedUser._id,
        getUsers: getUsersCallback,
      };
      dispatch(asyncDeleteUser(params));
    }
    setOpenDeleteUser({
      open: false,
      multiple: false,
    });
  };

  return (
    <div>
      <Paper variant="outlined" className={classes.root}>
        <Grid container>
          <Grid item xs={4}>
            <SearchFilter
              setSearch={setSearch}
              search={search}
              filter={filter}
              handleFilterChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={3} className={classes.groupActionContainer}>
            {selectedUsers.length > 1 && (
              <>
                <Button
                  variant="text"
                  className={classes.groupActionButton}
                  onClick={() =>
                    setOpenBlockUI({
                      open: true,
                      multiple: true,
                    })
                  }>
                  <BlockIcon color="primary" className={classes.groupActionButtonIcon} />
                  <Typography variant="subtitle2">Block/Unblock Selected Users</Typography>
                </Button>
                <Button
                  variant="text"
                  className={classes.groupActionButton}
                  onClick={() =>
                    setOpenDeleteUser({
                      open: true,
                      multiple: true,
                    })
                  }>
                  <DeleteIcon color="primary" className={classes.groupActionButtonIcon} />
                  <Typography variant="subtitle2">Delete Selected Users</Typography>
                </Button>
              </>
            )}
          </Grid>
          <Grid item xs={5}>
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
        open={openDeleteUser.open}
        handleClose={handleClose}
        title={handleDeleteTitle(openDeleteUser.multiple, selectedUser)}
        description={handleDeleteDescription(openDeleteUser.multiple, selectedUser)}
        buttonAction={deleteButtonAction}
        buttonText={'Delete'}
      />
      <ConfirmationDialog
        open={openBlockUI.open}
        handleClose={handleClose}
        title={handleBlockTitle(openBlockUI.multiple, selectedUser)}
        description={handleBlockDescription(openBlockUI.multiple, selectedUser)}
        buttonAction={handleBlock}
        buttonText={handleBlockButton(openBlockUI.multiple, selectedUser)}
      />
      <EditUserDialog open={openEditUser} data={selectedUser} handleClose={handleClose} />
    </div>
  );
};

Users.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticationLayout>{page}</AuthenticationLayout>;
};

export default Users;

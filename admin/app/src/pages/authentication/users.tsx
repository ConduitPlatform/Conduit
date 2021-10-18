import Typography from '@material-ui/core/Typography';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import NewUserModal from '../../components/authentication/AddUserDrawerContent';
import AuthUsers from '../../components/authentication/AuthUsers';
import Paginator from '../../components/common/Paginator';
import SearchFilter from '../../components/authentication/SearchFilter';
import Grid from '@material-ui/core/Grid';
import { Button, ButtonGroup, IconButton, makeStyles, Tooltip } from '@material-ui/core';
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
import { AddCircle } from '@material-ui/icons';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import { isString } from 'lodash';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(0),
    },
    marginBottom: '3px',
  },
  groupActionContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    alignItems: 'start',
  },
  addUserBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: theme.spacing(-2),
  },
  btnGroup: {
    marginRight: theme.spacing(3),
  },
}));

const Users = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { users, count } = useAppSelector((state) => state.authenticationSlice.data.authUsers);

  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState('all');
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
  const [drawer, setDrawer] = useState<boolean>(false);

  const debouncedSearch: string = useDebounce(search, 500);

  const handleFilterChange = (value: unknown) => {
    if (isString(value)) {
      setFilter(value);
    }
  };

  useEffect(() => {
    dispatch(asyncGetAuthenticationConfig());
  }, [dispatch]);

  useEffect(() => {
    dispatch(asyncGetAuthUserData({ skip, limit, search: debouncedSearch, filter }));
  }, [dispatch, filter, limit, skip, debouncedSearch]);

  const handleLimitChange = (value: number) => {
    setLimit(value);
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
    setDrawer(false);
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
      <Grid container>
        <Grid item xs={8}>
          <SearchFilter
            setSearch={setSearch}
            search={search}
            filter={filter}
            handleFilterChange={handleFilterChange}
          />
        </Grid>
        <Grid item xs={4} className={classes.addUserBtn}>
          {selectedUsers.length > 1 && (
            <ButtonGroup
              size="small"
              variant="contained"
              color="primary"
              className={classes.btnGroup}>
              <IconButton
                aria-label="block"
                color="primary"
                onClick={() =>
                  setOpenBlockUI({
                    open: true,
                    multiple: true,
                  })
                }>
                <Tooltip title="Block multiple users">
                  <BlockIcon />
                </Tooltip>
              </IconButton>
              <IconButton
                aria-label="delete"
                color="primary"
                onClick={() =>
                  setOpenDeleteUser({
                    open: true,
                    multiple: true,
                  })
                }>
                <Tooltip title="Delete multiple users">
                  <DeleteIcon />
                </Tooltip>
              </IconButton>
            </ButtonGroup>
          )}
          <Button
            color="primary"
            variant="contained"
            endIcon={<AddCircle />}
            onClick={() => setDrawer(true)}>
            ADD USER
          </Button>
        </Grid>
      </Grid>
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
      {users && users.length > 0 && (
        <Grid container style={{ marginTop: '-8px' }}>
          <Grid item xs={7} />
          <Grid item xs={5}>
            <Paginator
              handlePageChange={handlePageChange}
              limit={limit}
              handleLimitChange={handleLimitChange}
              page={page}
              count={count}
            />
          </Grid>
        </Grid>
      )}
      <DrawerWrapper
        open={drawer}
        maxWidth={550}
        closeDrawer={() => {
          setDrawer(false);
        }}>
        <NewUserModal handleNewUserDispatch={handleNewUserDispatch} />
      </DrawerWrapper>
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

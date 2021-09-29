import DataTable from '../common/DataTable';
import React, { useState } from 'react';
import ConfirmationDialog from '../common/ConfirmationDialog';
import EditUserDialog from './EditUserDialog';
import { AuthUser, AuthUserUI } from '../../models/authentication/AuthModels';
import {
  asyncBlockUserUI,
  asyncDeleteUser,
  asyncUnblockUserUI,
} from '../../redux/slices/authenticationSlice';
import { useAppDispatch } from '../../redux/store';

interface Props {
  users: AuthUser[];
}

const AuthUsers: React.FC<Props> = ({ users }) => {
  const dispatch = useAppDispatch();
  const [openEditUser, setOpenEditUser] = useState<boolean>(false);
  const [openDeleteUser, setOpenDeleteUser] = useState<boolean>(false);
  const [openBlockUI, setOpenBlockUI] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<AuthUser>({
    active: false,
    createdAt: '',
    email: '',
    isVerified: false,
    phoneNumber: '',
    updatedAt: '',
    _id: '',
  });

  const handleClose = () => {
    setOpenDeleteUser(false);
    setOpenEditUser(false);
    setOpenBlockUI(false);
  };

  const formatData = (users: AuthUser[]) => {
    return users.map((u) => {
      return {
        _id: u._id,
        Email: u.email ? u.email : 'N/A',
        Active: u.active,
        Verified: u.isVerified,
        'Registered At': u.createdAt,
      };
    });
  };

  const deleteButtonAction = (id: string) => {
    dispatch(asyncDeleteUser(id));
    setOpenDeleteUser(false);
  };

  const toDelete = {
    title: 'Delete',
    type: 'Delete',
  };

  const toEdit = {
    title: 'Edit',
    type: 'Edit',
  };

  const toBlock = {
    title: 'Block/Unblock UI',
    type: 'Block/Unblock UI',
  };

  const actions = [toDelete, toEdit, toBlock];

  const handleAction = (action: { title: string; type: string }, data: AuthUserUI) => {
    const currentUser = users.find((user) => user._id === data._id) as AuthUser;
    if (action.type === 'Edit') {
      setOpenEditUser(true);
      setSelectedUser(currentUser);
    } else if (action.type === 'Delete') {
      setOpenDeleteUser(true);
      setSelectedUser(currentUser);
    } else if (action.type === 'Block/Unblock UI') {
      setOpenBlockUI(true);
      setSelectedUser(currentUser);
    }
  };

  const handleBlockUI = () => {
    if (selectedUser.active) {
      dispatch(asyncBlockUserUI(selectedUser._id));
      setOpenBlockUI(false);
    } else {
      dispatch(asyncUnblockUserUI(selectedUser._id));
      setOpenBlockUI(false);
    }
  };

  return (
    <>
      {users.length > 0 && (
        <DataTable
          dsData={formatData(users)}
          actions={actions}
          handleAction={handleAction}
        />
      )}

      <ConfirmationDialog
        open={openDeleteUser}
        handleClose={handleClose}
        title={`Delete user ${selectedUser.email} `}
        description={`Are you sure you want to delete ${selectedUser.email}? \
        Active: ${selectedUser.active} \
        Verified: ${selectedUser.isVerified}`}
        buttonAction={() => deleteButtonAction(selectedUser._id)}
        buttonText={'Delete'}
      />
      <EditUserDialog open={openEditUser} data={selectedUser} handleClose={handleClose} />
      <ConfirmationDialog
        open={openBlockUI}
        handleClose={handleClose}
        title={selectedUser.active ? 'User has Unblocked UI' : 'User has Blocked UI'}
        description={
          selectedUser.active
            ? `Are you sure you want to block the UI of ${selectedUser.email}`
            : `Are you sure you want to Unblock the UI of ${selectedUser.email}`
        }
        buttonAction={handleBlockUI}
        buttonText={selectedUser.active ? 'Block' : 'Unblock'}
      />
    </>
  );
};

export default AuthUsers;

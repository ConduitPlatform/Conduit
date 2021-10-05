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
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

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
    type: 'delete',
  };

  const toEdit = {
    title: 'Edit',
    type: 'edit',
  };

  const toBlock = {
    title: 'Block/Unblock',
    type: 'block/unblock',
  };

  const actions = [toEdit, toDelete, toBlock];

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

  const handleBlockUI = () => {
    if (selectedUser.active) {
      dispatch(asyncBlockUserUI(selectedUser._id));
      setOpenBlockUI(false);
    } else {
      dispatch(asyncUnblockUserUI(selectedUser._id));
      setOpenBlockUI(false);
    }
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

  return (
    <>
      {users.length > 0 && (
        <DataTable
          dsData={formatData(users)}
          actions={actions}
          handleAction={handleAction}
          handleSelect={handleSelect}
          handleSelectAll={handleSelectAll}
          selectedItems={selectedUsers}
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
        title={selectedUser.active ? 'User is Unblocked' : 'User is Blocked'}
        description={
          selectedUser.active
            ? `Are you sure you want to block ${selectedUser.email}`
            : `Are you sure you want to Unblock ${selectedUser.email}`
        }
        buttonAction={handleBlockUI}
        buttonText={selectedUser.active ? 'Block' : 'Unblock'}
      />
    </>
  );
};

export default AuthUsers;

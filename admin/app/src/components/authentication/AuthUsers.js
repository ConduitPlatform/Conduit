import DataTable from '../common/DataTable';
import React, { useState } from 'react';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import {
  deleteUserThunk,
  blockUserUIThunk,
  unblockUserUIThunk,
} from '../../redux/thunks/authenticationThunks';
import { useDispatch } from 'react-redux';
import EditUserDialog from './EditUserDialog';

const AuthUsers = ({ users }) => {
  const [openEditUser, setOpenEditUser] = useState(false);
  const [openDeleteUser, setOpenDeleteUser] = useState(false);
  const [openBlockUI, setOpenBlockUI] = useState(false);
  const [data, setData] = useState({});

  const handleClose = () => {
    setOpenDeleteUser(false);
    setOpenEditUser(false);
    setOpenBlockUI(false);
  };

  const dispatch = useDispatch();

  const formatData = (users) => {
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

  const deleteButtonAction = (id) => {
    dispatch(deleteUserThunk(id));
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

  const handleAction = (action, data) => {
    if (action.type === 'Edit') {
      setOpenEditUser(true);
      setData(...users.filter((user) => user._id === data._id));
    } else if (action.type === 'Delete') {
      setOpenDeleteUser(true);
      setData(data);
    } else if (action.type === 'Block/Unblock UI') {
      setOpenBlockUI(true);
      setData(data);
    }
  };

  const handleBlockUI = () => {
    if (data.Active) {
      dispatch(blockUserUIThunk(data._id));
      setOpenBlockUI(false);
    } else {
      dispatch(unblockUserUIThunk(data._id));
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
        title={`Delete user ${data.Email} `}
        description={`Are you sure you want to delete ${data.Email}? \
        Active: ${data.Active} \
        Verified: ${data.Verified}`}
        buttonAction={() => deleteButtonAction(data._id)}
        buttonText={'Delete'}
      />
      <EditUserDialog open={openEditUser} data={data} handleClose={handleClose} />
      <ConfirmationDialog
        open={openBlockUI}
        handleClose={handleClose}
        title={data.Active ? 'User has Unblocked UI' : 'User has Blocked UI'}
        description={
          data.Active
            ? `Are you sure you want to block the UI of ${data.Email}`
            : `Are you sure you want to Unblock the UI of ${data.Email}`
        }
        buttonAction={handleBlockUI}
        buttonText={data.Active === true ? 'Block' : 'Unblock'}
      />
    </>
  );
};

export default AuthUsers;

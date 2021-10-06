import DataTable from '../common/DataTable';
import React  from 'react';
import { AuthUser, AuthUserUI } from '../../models/authentication/AuthModels';

interface Props {
  users: AuthUser[];
  handleAction: (action: { title: string; type: string }, data: AuthUserUI) => void;
  handleSelect: (id: string) => void;
  handleSelectAll: (data: any) => void;
  selectedUsers: string[];
}

const AuthUsers: React.FC<Props> = ({
  users,
  handleAction,
  handleSelect,
  handleSelectAll,
  selectedUsers,
}) => {
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

  return (
    <DataTable
      dsData={formatData(users)}
      actions={actions}
      handleAction={handleAction}
      handleSelect={handleSelect}
      handleSelectAll={handleSelectAll}
      selectedItems={selectedUsers}
    />
  );
};

export default AuthUsers;

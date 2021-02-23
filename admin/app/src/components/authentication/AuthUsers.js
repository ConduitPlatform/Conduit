import DataTable from '../common/DataTable';
import React from 'react';

const AuthUsers = ({ users }) => {
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

  return <>{users.length > 0 && <DataTable dsData={formatData(users)} />}</>;
};

export default AuthUsers;

import DataTable from '../common/DataTable';
import React from 'react';

const AuthUsers = ({ users }) => {
  const formatData = (users) => {
    return users.map((u) => {
      return {
        _id: u._id,
        email: u.email,
        active: u.active,
        isVerified: u.isVerified,
        createdAt: u.createdAt,
      };
    });
  };

  return <>{users.length > 0 && <DataTable dsData={formatData(users)} />}</>;
};

export default AuthUsers;

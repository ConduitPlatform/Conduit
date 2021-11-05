import React from 'react';
import SharedLayout from './sharedLayout';
import { People } from '@material-ui/icons';

const AuthenticationLayout: React.FC = ({ children }) => {
  const pathNames = [
    '/authentication/users',
    '/authentication/signIn',
    '/authentication/serviceAccounts',
    '/authentication/settings',
  ];
  const labels = ['users', 'signIn', 'serviceAccounts', 'settings'];

  return (
    <SharedLayout
      title={'Authentication'}
      labels={labels}
      pathNames={pathNames}
      swagger={'cms'}
      icon={<People />}>
      {children}
    </SharedLayout>
  );
};

export default AuthenticationLayout;

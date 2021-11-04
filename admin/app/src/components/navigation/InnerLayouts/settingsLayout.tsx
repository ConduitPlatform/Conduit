import React from 'react';
import SharedLayout from './sharedLayout';
import { Settings } from '@material-ui/icons';

const SettingsLayout: React.FC<unknown> = ({ children }) => {
  const pathNames = [
    '/settings/clientsdk',
    '/settings/secrets',
    '/settings/core',
    '/settings/createuser',
  ];
  const labels = ['clientsdk', 'secrets', 'core', 'createuser'];

  return (
    <SharedLayout
      title={'Settings'}
      labels={labels}
      pathNames={pathNames}
      swagger={'cms'}
      icon={<Settings />}>
      {children}
    </SharedLayout>
  );
};

export default SettingsLayout;

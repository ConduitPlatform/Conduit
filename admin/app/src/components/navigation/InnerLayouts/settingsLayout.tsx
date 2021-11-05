import React from 'react';
import SharedLayout from './sharedLayout';
import { Settings } from '@material-ui/icons';

const SettingsLayout: React.FC = ({ children }) => {
  const pathNames = [
    '/settings/clientsdk',
    '/settings/secrets',
    '/settings/core',
    '/settings/createuser',
  ];
  const labels = [
    { name: 'clients SDK', id: 'clientsdk' },
    { name: 'secrets', id: 'secrets' },
    { name: 'core', id: 'core' },
    { name: 'create User', id: 'createuser' },
  ];

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

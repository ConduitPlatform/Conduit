import React from 'react';
import SharedLayout from './sharedLayout';
import { Cloud } from '@material-ui/icons';

const StorageLayout: React.FC = ({ children }) => {
  const pathNames = ['/storage/files', '/storage/settings'];

  const labels = [
    { name: 'files', id: 'files' },
    { name: 'settings', id: 'settings' },
  ];

  return (
    <SharedLayout
      title={'Storage'}
      labels={labels}
      pathNames={pathNames}
      swagger={'storage'}
      icon={<Cloud />}>
      {children}
    </SharedLayout>
  );
};

export default StorageLayout;

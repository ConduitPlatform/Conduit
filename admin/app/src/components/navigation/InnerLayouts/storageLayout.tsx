import React from 'react';
import SharedLayout from './sharedLayout';
import { Cloud } from '@material-ui/icons';

const StorageLayout: React.FC = ({ children }) => {
  const pathNames = ['/storage/files', '/storage/settings'];
  const labels = ['files', 'settings'];

  return (
    <SharedLayout
      title={'Storage'}
      labels={labels}
      pathNames={pathNames}
      swagger={'cms'}
      icon={<Cloud />}>
      {children}
    </SharedLayout>
  );
};

export default StorageLayout;

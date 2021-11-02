import React, { ReactElement } from 'react';
import StorageLayout from '../../components/navigation/InnerLayouts/storageLayout';
import StorageFiles from '../../components/storage/StorageFiles';

const Files = () => {
  return <StorageFiles />;
};

Files.getLayout = function getLayout(page: ReactElement) {
  return <StorageLayout>{page}</StorageLayout>;
};

export default Files;

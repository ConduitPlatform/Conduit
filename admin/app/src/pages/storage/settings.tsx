import React, { ReactElement, useEffect } from 'react';
import StorageLayout from '../../components/navigation/InnerLayouts/storageLayout';
import StorageSettings from '../../components/storage/StorageSettings';
import { IStorageConfig } from '../../models/storage/StorageModels';
import { asyncGetStorageConfig, asyncSaveStorageConfig } from '../../redux/slices/storageSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';

const Files = () => {
  const dispatch = useAppDispatch();

  const { config } = useAppSelector((state) => state.storageSlice.data);

  useEffect(() => {
    dispatch(asyncGetStorageConfig());
  }, [dispatch]);

  const handleStorageSettings = (data: IStorageConfig) => {
    dispatch(asyncSaveStorageConfig(data));
  };
  return <StorageSettings config={config} handleSave={handleStorageSettings} />;
};

Files.getLayout = function getLayout(page: ReactElement) {
  return <StorageLayout>{page}</StorageLayout>;
};

export default Files;

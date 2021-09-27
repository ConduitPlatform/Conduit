import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import React, { useEffect, useState } from 'react';
import { privateRoute } from '../components/utils/privateRoute';
import StorageFiles from '../components/storage/StorageFiles';
import StorageSettings from '../components/storage/StorageSettings';
import { IStorageConfig } from '../models/storage/StorageModels';
import {
  asyncGetStorageConfig,
  asyncSaveStorageConfig,
} from '../redux/slices/storageSlice';
import { useAppDispatch, useAppSelector } from '../redux/store';

const tabs = [{ title: 'Files' }, { title: 'Settings' }];

const Storage: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const dispatch = useAppDispatch();

  const { config } = useAppSelector((state) => state.storageSlice.data);

  useEffect(() => {
    dispatch(asyncGetStorageConfig());
  }, [dispatch]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
  };

  const handleStorageSettings = (data: IStorageConfig) => {
    dispatch(asyncSaveStorageConfig(data));
  };

  return (
    <>
      <Box p={2}>
        <Typography variant={'h4'}>Storage</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          <StorageFiles />
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          <StorageSettings config={config} handleSave={handleStorageSettings} />
        </Box>
      </Box>
    </>
  );
};

export default privateRoute(Storage);

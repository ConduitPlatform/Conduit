import { privateRoute } from '../components/utils/privateRoute';
import { Layout } from '../components/navigation/Layout';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { getAvailableClients } from '../redux/thunks/settingsThunks';
import CoreSettingsTab from '../components/settings/CoreSettingsTab';
import SecretsTab from '../components/settings/SecretsTab';
import SdksTab from '../components/settings/SdksTab';

const tabs = [{ title: 'Client SDKs' }, { title: 'Secrets' }, { title: 'Core' }];

const Settings = () => {
  const dispatch = useDispatch();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    dispatch(getAvailableClients());
  }, [dispatch]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
  };

  return (
    <Layout itemSelected={7}>
      <Box p={2}>
        <Typography variant={'h4'}>Global Settings</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          <SdksTab />
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          <SecretsTab />
        </Box>
        <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
          <CoreSettingsTab />
        </Box>
      </Box>
    </Layout>
  );
};

export default privateRoute(Settings);

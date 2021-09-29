import { privateRoute } from '../components/utils/privateRoute';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import React, { useState } from 'react';
import CoreSettingsTab from '../components/settings/CoreSettingsTab';
import SecretsTab from '../components/settings/SecretsTab';
import SdksTab from '../components/settings/SdksTab';
import CreateNewUserTab from '../components/settings/CreateNewUserTab';

const tabs = [
  { title: 'Client SDKs' },
  { title: 'Secrets' },
  { title: 'Core' },
  { title: 'Create New User' },
];

const Settings = () => {
  const [selected, setSelected] = useState(3);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
  };

  return (
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
      <Box role="tabpanel" hidden={selected !== 3} id={`tabpanel-3`}>
        <CreateNewUserTab />
      </Box>
    </Box>
  );
};

export default privateRoute(Settings);

import { privateRoute } from '../components/utils/privateRoute';
import { Layout } from '../components/navigation/Layout';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import { GetApp } from '@material-ui/icons';

const Settings = () => {
  const tabs = [{ title: 'Client SDKs' }];

  const [selected, setSelected] = useState(0);

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };
  return (
    <Layout itemSelected={6}>
      <Box p={2}>
        <Typography variant={'h4'}>Global Settings</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<GetApp />}
            onClick={() => {
              window.open(
                'https://tenor.com/view/handgesturesmyt-ok-okay-gif-14118577',
                '_blank'
              );
            }}>
            GraphQL client
          </Button>
        </Box>
      </Box>
    </Layout>
  );
};

export default privateRoute(Settings);

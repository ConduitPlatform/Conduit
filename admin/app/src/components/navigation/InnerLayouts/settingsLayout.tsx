import React, { useEffect, useState } from 'react';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box } from '@material-ui/core';
import { useRouter } from 'next/router';

const CmsLayout: React.FC<unknown> = ({ children }) => {
  const router = useRouter();
  const [value, setValue] = useState(0);

  const pathnames = ['/settings/clientsdk', '/settings/secrets', '/settings/core', '/settings/createuser'];

  useEffect(() => {
    const index = pathnames.findIndex((pathname) => pathname === router.pathname);
    setValue(index);
  });

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setValue(newValue);
    router.push(`${event.currentTarget.id}`, undefined, { shallow: false });
  };

  return (
    <Box p={4}>
      <Typography variant={'h4'}>Authentication</Typography>
      <Tabs value={value} onChange={handleChange}>
        <Tab label="Client SDKs" id="clientsdk" />
        <Tab label="Secrets" id="secrets" />
        <Tab label="Core" id="core" />
        <Tab label="Create New User" id="createuser" />
      </Tabs>
      <Box marginTop={3}>{children}</Box>
    </Box>
  );
};

export default CmsLayout;

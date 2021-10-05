import React, { useEffect, useState } from 'react';

import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box } from '@material-ui/core';
import { useRouter } from 'next/router';

const StorageLayout: React.FC<unknown> = ({ children }) => {
  const router = useRouter();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const pathNames = ['/storage/files', '/storage/settings'];
    const index = pathNames.findIndex((pathname) => pathname === router.pathname);
    setValue(index);
  }, [router.pathname]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setValue(newValue);
    router.push(`${event.currentTarget.id}`, undefined, { shallow: false });
  };

  return (
    <Box p={4}>
      <Typography variant={'h4'}>Storage</Typography>
      <Tabs value={value} onChange={handleChange}>
        <Tab label="Files" id="files" />
        <Tab label="Settings" id="settings" />
      </Tabs>
      <Box marginTop={3}>{children}</Box>
    </Box>
  );
};

export default StorageLayout;

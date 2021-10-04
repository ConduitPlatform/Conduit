import React, { useEffect, useState } from 'react';

import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box } from '@material-ui/core';
import { useRouter } from 'next/router';

const EmailsLayout: React.FC<unknown> = ({ children }) => {
  const router = useRouter();
  const [value, setValue] = useState(0);

  const pathnames = ['/emails/templates', '/emails/send', '/emails/provider'];

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
      <Typography variant={'h4'}>Emails</Typography>
      <Tabs value={value} onChange={handleChange}>
        <Tab label="Templates" id="templates" />
        <Tab label="Send Email" id="send" />
        <Tab label="Provider details" id="provider" />
      </Tabs>
      <Box marginTop={3}>{children}</Box>
    </Box>
  );
};

export default EmailsLayout;

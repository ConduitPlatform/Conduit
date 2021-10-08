import React, { useEffect, useState } from 'react';

import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box, Button } from '@material-ui/core';
import { useRouter } from 'next/router';
import sharedClasses from './sharedClasses';
import { Sms } from '@material-ui/icons';

const SMSLayout: React.FC<unknown> = ({ children }) => {
  const classes = sharedClasses();
  const router = useRouter();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const pathNames = ['/sms/send', '/sms/provider-settings'];
    const index = pathNames.findIndex((pathname) => pathname === router.pathname);
    setValue(index);
  }, [router.pathname]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setValue(newValue);
    router.push(`${event.currentTarget.id}`, undefined, { shallow: false });
  };

  return (
    <Box p={4}>
      <Box className={classes.navBar}>
        <Typography variant={'h4'}>
          SMS
          <a target="_blank" rel="noreferrer" className={classes.swaggerButton}>
            <Button variant="outlined" endIcon={<Sms />}>
              SWAGGER
            </Button>
          </a>
        </Typography>
        <Tabs value={value} onChange={handleChange}>
          <Tab label="Send SMS" id="send" />
          <Tab label="Provider details'" id="provider-details" />
        </Tabs>
      </Box>
      <Box className={classes.content}>{children}</Box>
    </Box>
  );
};

export default SMSLayout;

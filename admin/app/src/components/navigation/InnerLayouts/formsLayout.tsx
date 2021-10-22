import React, { useEffect, useState } from 'react';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box, Button } from '@material-ui/core';
import { useRouter } from 'next/router';
import sharedClasses from './sharedClasses';
import { FormatAlignLeft } from '@material-ui/icons';

const FormsLayout: React.FC<unknown> = ({ children }) => {
  const classes = sharedClasses();
  const router = useRouter();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const pathNames = ['/forms/view', '/forms/settings'];
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
        <Typography className={classes.navContent} variant={'h4'}>
          Forms
          <a target="_blank" rel="noreferrer" className={classes.swaggerButton}>
            <Button variant="outlined" endIcon={<FormatAlignLeft />}>
              SWAGGER
            </Button>
          </a>
        </Typography>
        <Tabs value={value} className={classes.navContent} onChange={handleChange}>
          <Tab label="View" id="view" />
          <Tab label="Settings" id="settings" />
        </Tabs>
      </Box>
      <Box className={classes.content}>{children}</Box>
    </Box>
  );
};

export default FormsLayout;

import React, { useEffect, useState } from 'react';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box, Button } from '@material-ui/core';
import { useRouter } from 'next/router';
import sharedClasses from './sharedClasses';
import { Toc } from '@material-ui/icons';

const ChatLayout: React.FC<unknown> = ({ children }) => {
  const classes = sharedClasses();
  const router = useRouter();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const pathNames = ['/chat/rooms', '/chat/settings'];
    const index = pathNames.findIndex((pathname) => pathname === router.pathname);
    setValue(index);
  }, [router.pathname]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setValue(newValue);
    router.push(`${event.currentTarget.id}`, undefined, { shallow: false });
  };

  return (
    <Box p={4} className={classes.chatRoot}>
      <Box className={classes.navBar}>
        <Typography className={classes.navContent} variant={'h4'}>
          Chat
          <a
            href={`${process.env.CONDUIT_URL}/swagger/#/chat`}
            target="_blank"
            rel="noreferrer"
            className={classes.swaggerButton}>
            <Button variant="outlined" endIcon={<Toc />}>
              SWAGGER
            </Button>
          </a>
        </Typography>
        <Tabs value={value} className={classes.navContent} onChange={handleChange}>
          <Tab label="Rooms" id="rooms" />
          <Tab label="Settings" id="settings" />
        </Tabs>
      </Box>
      <Box className={classes.chatContent}>{children}</Box>
    </Box>
  );
};

export default ChatLayout;

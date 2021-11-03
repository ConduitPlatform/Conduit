import React from 'react';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(() => ({
  root: {},
}));

const ChatRooms: React.FC = () => {
  const classes = useStyles();

  return <Box className={classes.root}>Coming rooms</Box>;
};

export default ChatRooms;

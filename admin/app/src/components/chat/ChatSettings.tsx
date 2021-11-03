import React from 'react';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(() => ({
  root: {},
}));

const ChatSettings: React.FC = () => {
  const classes = useStyles();

  return <Box className={classes.root}>Coming settings</Box>;
};

export default ChatSettings;

import React, { FC } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { BoxProps } from '@material-ui/core/Box/Box';
import { makeStyles } from '@material-ui/core/styles';
import ChatRoomBubble from './ChatRoomBubble';

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    padding: theme.spacing(2),
  },
}));

interface Props extends BoxProps {
  name: string;
}

const ChatRoomPanel: FC<Props> = ({ name, ...rest }) => {
  const classes = useStyles();
  return (
    <Box className={classes.root} {...rest}>
      <Typography>{name}</Typography>
      <ChatRoomBubble />
    </Box>
  );
};

export default ChatRoomPanel;

import React, { FC } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { BoxProps } from '@material-ui/core/Box/Box';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },
  contentContainer: {
    backgroundColor: theme.palette.grey[700],
    borderRadius: theme.spacing(2),
    padding: theme.spacing(1, 2),
    maxWidth: '80%',
  },
  iconContainer: {
    height: theme.spacing(4),
    width: theme.spacing(4),
    borderRadius: '50%',
    backgroundColor: 'purple',
    marginRight: theme.spacing(1),
  },
}));

interface Props extends BoxProps {
  message: string;
}

const ChatRoomBubble: FC<Props> = ({ message, className, ...rest }) => {
  const classes = useStyles();
  return (
    <Box className={clsx(classes.root, className)} {...rest}>
      <Box className={classes.iconContainer} />
      <Box className={classes.contentContainer}>
        <Typography variant="body2">{message}</Typography>
      </Box>
    </Box>
  );
};

export default ChatRoomBubble;

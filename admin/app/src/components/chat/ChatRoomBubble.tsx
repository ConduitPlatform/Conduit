import React, { forwardRef } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import { IChatMessage } from '../../models/chat/ChatModels';
import { Tooltip } from '@material-ui/core';
import moment from 'moment';

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

interface Props {
  data: IChatMessage;
  className: string;
}

const ChatRoomBubble = forwardRef<HTMLDivElement, Props>(({ data, className, ...rest }, ref) => {
  const classes = useStyles();
  return (
    <div className={clsx(classes.root, className)} ref={ref} {...rest}>
      <Box className={classes.iconContainer} />
      <Tooltip
        title={`Sent: ${moment(data.createdAt).format('MMM Do YYYY, h:mm:ss a')}`}
        placement="right">
        <Box className={classes.contentContainer}>
          <Typography variant="body2">{data.message}</Typography>
        </Box>
      </Tooltip>
    </div>
  );
});

ChatRoomBubble.displayName = 'ChatRoomBubble';

export default ChatRoomBubble;

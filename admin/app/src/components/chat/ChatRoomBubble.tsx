import React, { FC } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import { IChatMessage } from '../../models/chat/ChatModels';
import { Tooltip } from '@material-ui/core';
import moment from 'moment';
import useLongPress from '../../hooks/useLongPress';
import { Skeleton } from '@material-ui/lab';

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
    cursor: 'pointer',
  },
}));

interface Props {
  data: IChatMessage;
  className?: string;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

const ChatRoomBubble: FC<Props> = ({ data, className, onPress, onLongPress, ...rest }) => {
  const classes = useStyles();

  const handleLongPress = () => {
    onLongPress(data._id);
  };

  const handlePress = () => {
    onPress(data._id);
  };

  const defaultOptions = {
    shouldPreventDefault: false,
    delay: 500,
  };
  const longPressEvent = useLongPress(handleLongPress, handlePress, defaultOptions);

  return (
    <div className={clsx(classes.root, className)} {...longPressEvent} {...rest}>
      <Box className={classes.iconContainer} />
      <Tooltip
        title={`Sent: ${moment(data?.createdAt).format('MMM Do YYYY, h:mm:ss a')}`}
        placement="right">
        <Box className={classes.contentContainer}>
          <Typography variant="body2">{data?.message}</Typography>
        </Box>
      </Tooltip>
    </div>
  );
};

export default ChatRoomBubble;

interface SkeletonProps {
  className: string;
}

export const ChatRoomBubbleSkeleton: FC<SkeletonProps> = ({ className, ...rest }) => {
  const classes = useStyles();
  return (
    <div className={clsx(classes.root, className)} {...rest}>
      <Skeleton animation={false} className={classes.iconContainer} />
      <Skeleton animation={false} className={classes.contentContainer} />
    </div>
  );
};

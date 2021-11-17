import React, { FC } from 'react';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import { IChatRoom } from '../../models/chat/ChatModels';
import useLongPress from '../../hooks/useLongPress';
import { Skeleton } from '@material-ui/lab';

const useStyles = makeStyles((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: theme.spacing(1),
  },
  skeletonContentContainer: {
    backgroundColor: theme.palette.grey[700],
    width: '100%',
  },
}));

interface Props {
  data: IChatRoom;
  className?: string;
  onPress: () => void;
  onLongPress: () => void;
}

const ChatRoomTab: FC<Props> = ({ data, className, onPress, onLongPress, ...rest }) => {
  const classes = useStyles();

  const defaultOptions = {
    shouldPreventDefault: false,
    delay: 500,
  };
  const longPressEvent = useLongPress(onLongPress, onPress, defaultOptions);

  return (
    <div className={clsx(classes.root, className)} {...longPressEvent} {...rest}>
      <Typography variant="body2">{data?.name}</Typography>
    </div>
  );
};

export default ChatRoomTab;

export const ChatRoomTabSkeleton: FC = ({ ...rest }) => {
  const classes = useStyles();
  return (
    <div className={classes.root} {...rest}>
      <Skeleton
        animation="wave"
        variant="rect"
        height={32}
        className={classes.skeletonContentContainer}
      />
    </div>
  );
};

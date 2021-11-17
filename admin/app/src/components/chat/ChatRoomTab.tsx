import React, { FC } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import { IChatMessage, IChatRoom } from '../../models/chat/ChatModels';
import { Tooltip } from '@material-ui/core';
import moment from 'moment';
import useLongPress from '../../hooks/useLongPress';
import { Skeleton } from '@material-ui/lab';
import { AccessibleForward } from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: theme.spacing(1),
  },
  contentContainer: {
    backgroundColor: theme.palette.grey[700],
    borderRadius: theme.spacing(2),
    padding: theme.spacing(1, 2),
    maxWidth: '80%',
  },
  skeletonContentContainer: {
    backgroundColor: theme.palette.grey[700],
    width: '30%',
    borderRadius: theme.spacing(2),
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

// interface SkeletonProps {
//   className: string;
// }

// export const ChatRoomBubbleSkeleton: FC<SkeletonProps> = ({ className, ...rest }) => {
//   const classes = useStyles();
//   return (
//     <div className={clsx(classes.root, className)} {...rest}>
//       <Skeleton
//         animation="wave"
//         variant="circle"
//         height={32}
//         width={32}
//         className={classes.skeletonIconContainer}
//       />
//       <Skeleton
//         animation="wave"
//         variant="rect"
//         height={32}
//         className={classes.skeletonContentContainer}
//       />
//     </div>
//   );
// };

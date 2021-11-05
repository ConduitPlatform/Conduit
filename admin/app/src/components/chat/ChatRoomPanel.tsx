import React, { FC, useCallback, useEffect, useRef } from 'react';
import Box from '@material-ui/core/Box';
import { BoxProps } from '@material-ui/core/Box/Box';
import { makeStyles } from '@material-ui/core/styles';
import ChatRoomBubble from './ChatRoomBubble';
import { IChatRoom } from '../../models/chat/ChatModels';
import { addChatMessagesSkip, asyncGetChatMessages } from '../../redux/slices/chatSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: 'scroll',
  },
  bubble: {
    marginBottom: theme.spacing(2),
  },
}));

interface Props extends BoxProps {
  panelData: IChatRoom;
}

const ChatRoomPanel: FC<Props> = ({ panelData, ...rest }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();
  const {
    chatMessages: { data, skip, hasMore },
  } = useAppSelector((state) => state.chatSlice.data);
  const { loading } = useAppSelector((state) => state.chatSlice.data.chatMessages);

  const observer = useRef<IntersectionObserver>();
  const lastMessageElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          dispatch(addChatMessagesSkip());
        }
      });
      if (node && observer.current) observer.current.observe(node);
    },
    [dispatch, hasMore, loading]
  );

  useEffect(() => {
    const params = {
      skip: skip,
      roomId: panelData._id,
    };
    dispatch(asyncGetChatMessages(params));
  }, [panelData._id, dispatch, skip]);

  return (
    <Box className={classes.root} {...rest}>
      {data.map((item, index) => {
        if (index === data.length - 1) {
          return (
            <div ref={lastMessageElementRef} key={index}>
              <ChatRoomBubble message={item.message} className={classes.bubble} />
            </div>
          );
        }
        return <ChatRoomBubble message={item.message} className={classes.bubble} key={index} />;
      })}
    </Box>
  );
};

export default ChatRoomPanel;

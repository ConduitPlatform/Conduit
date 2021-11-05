import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
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
}));

interface Props extends BoxProps {
  panelData: IChatRoom;
}

const ChatRoomPanel: FC<Props> = ({ panelData, ...rest }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();
  const {
    chatMessages: { data, count, skip, hasMore },
  } = useAppSelector((state) => state.chatSlice.data);
  const { loading } = useAppSelector((state) => state.appSlice);

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
      {data.map((message, index) => {
        if (index === data.length - 1) {
          return (
            <div
              ref={lastMessageElementRef}
              style={{ margin: '48px 0', backgroundColor: 'purple' }}
              key={index}>
              <Box>{message.message}</Box>
              <Box>{message.message}</Box>
              <Box>{message.message}</Box>
            </div>
          );
        }
        return (
          <Box key={index} style={{ margin: '48px 0', backgroundColor: 'purple' }}>
            <Box>{message.message}</Box>
            <Box>{message.message}</Box>
            <Box>{message.message}</Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default ChatRoomPanel;

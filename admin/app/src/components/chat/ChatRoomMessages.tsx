import React, { CSSProperties, FC, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { asyncGetChatMessages } from '../../redux/slices/chatSlice';
import { makeStyles } from '@material-ui/core/styles';
import memoize from 'memoize-one';
import ChatRoomBubble, { ChatRoomBubbleSkeleton } from './ChatRoomBubble';
import clsx from 'clsx';
import { Typography } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  bubble: {
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(1, 1),
    borderRadius: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
  },
  bubbleSelected: {
    backgroundColor: `${theme.palette.grey[700]}80`,
  },
  placeholder: {
    whiteSpace: 'nowrap',
  },
}));

interface ItemStatus {
  [key: string]: string;
}
const timeoutAmount = 750;
let messagesStatusMap: ItemStatus = {};

const Row = ({ data, index, style }: ListChildComponentProps) => {
  const { messages, messagesCount, selectedMessages, onPress, onLongPress, classes } = data;
  const rowItem = messages[messagesCount - index - 1];
  const loading = !(messagesStatusMap[index] === 'LOADED' && rowItem);
  const isSelected = rowItem && selectedMessages.includes(rowItem._id);

  const getClassName = () => {
    if (isSelected) {
      return clsx(classes.bubble, classes.bubbleSelected);
    }
    return classes.bubble;
  };

  return (
    <div style={style as CSSProperties}>
      {loading ? (
        <ChatRoomBubbleSkeleton className={classes.bubble} />
      ) : (
        <ChatRoomBubble
          data={rowItem}
          className={getClassName()}
          onLongPress={onLongPress}
          onPress={onPress}
        />
      )}
    </div>
  );
};

const createItemData = memoize(
  (messages, messagesCount, selectedMessages, onPress, onLongPress, classes) => ({
    messages,
    messagesCount,
    selectedMessages,
    onPress,
    onLongPress,
    classes,
  })
);

const isItemLoaded = (index: number) => {
  return !!messagesStatusMap[index];
};

interface Props {
  roomId: string;
  selectedPanel: number;
  selectedMessages: string[];
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

const ChatRoomMessages: FC<Props> = ({
  roomId,
  selectedPanel,
  selectedMessages,
  onPress,
  onLongPress,
}) => {
  const dispatch = useAppDispatch();
  const classes = useStyles();
  const {
    chatMessages: { data, count, areEmpty },
  } = useAppSelector((state) => state.chatSlice.data);

  const infiniteLoaderRef = useRef<any>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (infiniteLoaderRef.current && hasMountedRef.current) {
      infiniteLoaderRef.current.resetloadMoreItemsCache();
      messagesStatusMap = {};
    }
    hasMountedRef.current = true;
  }, [selectedPanel, count]);

  const getChatMessages = useCallback(
    (skip: number, limit: number) => {
      const params = {
        skip: skip,
        limit: limit,
        roomId: roomId,
      };
      dispatch(asyncGetChatMessages(params));
    },
    [dispatch, roomId]
  );

  useEffect(() => {
    getChatMessages(0, 20);
  }, [getChatMessages]);

  const debouncedGetApiItems = debounce(
    (skip: number, limit: number) => getChatMessages(skip, limit),
    timeoutAmount
  );

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    const limit = count - startIndex - data.length;
    debouncedGetApiItems(data.length, limit);
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        for (let index = startIndex; index <= stopIndex; index++) {
          messagesStatusMap[index] = 'LOADED';
        }
        resolve(undefined);
        clearTimeout(timeout);
      }, timeoutAmount);
      return timeout;
    });
  };

  const itemData = createItemData(data, count, selectedMessages, onPress, onLongPress, classes);

  return (
    <AutoSizer>
      {({ height, width }) => {
        if (!count) {
          if (areEmpty)
            return <Typography className={classes.placeholder}>No available messages</Typography>;
          return <></>;
        }
        return (
          <InfiniteLoader
            ref={infiniteLoaderRef}
            isItemLoaded={isItemLoaded}
            itemCount={count}
            loadMoreItems={loadMoreItems}>
            {({ onItemsRendered, ref }) => {
              return (
                <List
                  height={height}
                  itemCount={count}
                  itemSize={56}
                  onItemsRendered={onItemsRendered}
                  ref={ref}
                  initialScrollOffset={count * 56}
                  itemData={itemData}
                  width={width}>
                  {Row}
                </List>
              );
            }}
          </InfiniteLoader>
        );
      }}
    </AutoSizer>
  );
};

export default ChatRoomMessages;

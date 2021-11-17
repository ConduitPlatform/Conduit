import React, { FC, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { asyncGetChatMessages } from '../../redux/slices/chatSlice';
import { makeStyles } from '@material-ui/core/styles';
import memoize from 'memoize-one';
import Row from './ChatRoomMessage';

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
}));

interface ItemStatus {
  [key: string]: string;
}
const timeoutAmount = 750;
let itemStatusMap: ItemStatus = {};

interface Props {
  roomId: string;
  selectedPanel: number;
  selectedMessages: string[];
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

const createItemData = memoize(
  (messages, messagesCount, selectedMessages, onPress, onLongPress, classes, itemStatusMap) => ({
    messages,
    messagesCount,
    selectedMessages,
    onPress,
    onLongPress,
    classes,
    itemStatusMap,
  })
);

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
    chatMessages: { data, count },
  } = useAppSelector((state) => state.chatSlice.data);

  const infiniteLoaderRef = useRef<any>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (infiniteLoaderRef.current && hasMountedRef.current) {
      infiniteLoaderRef.current.resetloadMoreItemsCache();
      itemStatusMap = {};
    }
    hasMountedRef.current = true;
  }, [selectedPanel, count]);

  const isItemLoaded = (index: number) => {
    return !!itemStatusMap[index];
  };

  const getApiItems = useCallback(
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
    getApiItems(0, 20);
  }, [getApiItems]);

  const debouncedGetApiItems = debounce(
    (skip: number, limit: number) => getApiItems(skip, limit),
    timeoutAmount
  );

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    const limit = count - startIndex - data.length;
    debouncedGetApiItems(data.length, limit);
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        for (let index = startIndex; index <= stopIndex; index++) {
          itemStatusMap[index] = 'LOADED';
        }
        resolve(undefined);
        clearTimeout(timeout);
      }, timeoutAmount);
      return timeout;
    });
  };

  const itemData = createItemData(
    data,
    count,
    selectedMessages,
    onPress,
    onLongPress,
    classes,
    itemStatusMap
  );

  return (
    <AutoSizer>
      {({ height, width }) => {
        if (!count) return <div>Loading</div>;
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

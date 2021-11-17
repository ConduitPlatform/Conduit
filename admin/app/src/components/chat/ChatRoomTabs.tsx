import React, { CSSProperties, FC, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';
import { useAppDispatch } from '../../redux/store';
import { asyncGetChatRooms } from '../../redux/slices/chatSlice';
import { makeStyles } from '@material-ui/core/styles';
import memoize from 'memoize-one';
import clsx from 'clsx';
import { IChatRoom } from '../../models/chat/ChatModels';
import ChatRoomTab from './ChatRoomTab';

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
let tabsStatusMap: ItemStatus = {};

const Row = ({ data, index, style }: ListChildComponentProps) => {
  const { messages, messagesCount, onPress, onLongPress, classes } = data;
  const rowItem = messages[index];
  const loading = !(tabsStatusMap[index] === 'LOADED' && rowItem);
  // const isSelected = rowItem && selectedMessages.includes(rowItem._id);

  return (
    <div style={style as CSSProperties}>
      {loading ? (
        <div>loading...</div>
      ) : (
        <ChatRoomTab
          onPress={() => console.log('onPress')}
          onLongPress={() => console.log('onLongPress')}
          data={rowItem}
        />
      )}

      {/*{loading ? (*/}
      {/*  <ChatRoomBubbleSkeleton className={classes.bubble} />*/}
      {/*) : (*/}
      {/*  <ChatRoomBubble*/}
      {/*    data={rowItem}*/}
      {/*    className={isSelected ? clsx(classes.bubble, classes.bubbleSelected) : classes.bubble}*/}
      {/*    onLongPress={onLongPress}*/}
      {/*    onPress={onPress}*/}
      {/*  />*/}
      {/*)}*/}
    </div>
  );
};

const createItemData = memoize((messages, messagesCount, onPress, onLongPress, classes) => ({
  messages,
  messagesCount,
  onPress,
  onLongPress,
  classes,
}));

const isItemLoaded = (index: number) => !!tabsStatusMap[index];

interface Props {
  chatRooms: IChatRoom[];
  chatRoomCount: number;
  // selectedPanel: number;
  // selectedMessages: string[];
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
}

const ChatRoomTabs: FC<Props> = ({
  chatRooms,
  chatRoomCount,
  // selectedPanel,
  // selectedMessages,
  onPress,
  onLongPress,
}) => {
  const dispatch = useAppDispatch();
  const classes = useStyles();

  const infiniteLoaderRef = useRef<any>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (infiniteLoaderRef.current && hasMountedRef.current) {
      infiniteLoaderRef.current.resetloadMoreItemsCache();
      tabsStatusMap = {};
    }
    hasMountedRef.current = true;
  }, [chatRoomCount]);

  const getChatRooms = useCallback(
    (skip: number, limit: number) => {
      const params = {
        skip: skip,
        limit: limit,
        // search: roomId,
      };
      dispatch(asyncGetChatRooms(params));
    },
    [dispatch]
  );

  const debouncedGetApiItems = debounce(
    (skip: number, limit: number) => getChatRooms(skip, limit),
    timeoutAmount
  );

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    const limit = stopIndex + 1;
    debouncedGetApiItems(chatRooms.length, limit);
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        for (let index = startIndex; index <= stopIndex; index++) {
          tabsStatusMap[index] = 'LOADED';
        }
        resolve(undefined);
        clearTimeout(timeout);
      }, timeoutAmount);
      return timeout;
    });
  };

  const itemData = createItemData(chatRooms, chatRoomCount, onPress, onLongPress, classes);

  return (
    <AutoSizer>
      {({ height, width }) => {
        if (!chatRoomCount) return <div>Loading</div>;
        return (
          <InfiniteLoader
            ref={infiniteLoaderRef}
            isItemLoaded={isItemLoaded}
            itemCount={chatRoomCount}
            loadMoreItems={loadMoreItems}>
            {({ onItemsRendered, ref }) => {
              return (
                <List
                  height={height}
                  itemCount={chatRoomCount}
                  itemSize={56}
                  onItemsRendered={onItemsRendered}
                  ref={ref}
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

export default ChatRoomTabs;

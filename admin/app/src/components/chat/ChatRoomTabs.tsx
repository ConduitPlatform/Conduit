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
  bubble: {},
  bubbleSelected: {
    backgroundColor: `${theme.palette.grey[700]}80`,
  },
  noScrollbars: {
    scrollbarWidth: 'thin',
    scrollbarColor: 'transparent transparent',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: 'transparent',
    },
  },
}));

interface ItemStatus {
  [key: string]: string;
}
const timeoutAmount = 750;
let tabsStatusMap: ItemStatus = {};

const Row = ({ data, index, style }: ListChildComponentProps) => {
  const { rooms, onPress, onLongPress, selectedTab, classes } = data;
  const rowItem = rooms[index];
  const loading = !(tabsStatusMap[index] === 'LOADED' && rowItem);
  const isSelected = selectedTab === index;

  return (
    <div style={style as CSSProperties}>
      {loading ? (
        <div>loading...</div>
      ) : (
        <ChatRoomTab
          onPress={() => onPress(index)}
          onLongPress={() => onLongPress(index)}
          data={rowItem}
          className={isSelected ? clsx(classes.bubble, classes.bubbleSelected) : classes.bubble}
        />
      )}
    </div>
  );
};

const createItemData = memoize((rooms, onPress, onLongPress, selectedTab, classes) => ({
  rooms,
  onPress,
  onLongPress,
  selectedTab,
  classes,
}));

const isItemLoaded = (index: number) => !!tabsStatusMap[index];

interface Props {
  chatRooms: IChatRoom[];
  chatRoomCount: number;
  selectedTab: number;
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
  debouncedSearch: string;
}

const ChatRoomTabs: FC<Props> = ({
  chatRooms,
  chatRoomCount,
  selectedTab,
  onPress,
  onLongPress,
  debouncedSearch,
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
  }, []);

  const getChatRooms = useCallback(
    (skip: number, limit: number) => {
      const params = {
        skip: skip,
        limit: limit,
        search: debouncedSearch,
      };
      dispatch(asyncGetChatRooms(params));
    },
    [debouncedSearch, dispatch]
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

  const itemData = createItemData(chatRooms, onPress, onLongPress, selectedTab, classes);

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
                  className={classes.noScrollbars}
                  // style={{ overflow: 'hidden' }}
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

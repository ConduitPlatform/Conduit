import React, { CSSProperties, FC, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { asyncGetChatMessages } from '../../redux/slices/chatSlice';
import clsx from 'clsx';
import ChatRoomBubble, { ChatRoomBubbleSkeleton } from './ChatRoomBubble';
import { makeStyles } from '@material-ui/core/styles';

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
  [key: string]: number;
}
// const LOADING = 1;
const timeoutAmount = 500;
const LOADED = 2;
let itemStatusMap: ItemStatus = {};

interface Props {
  roomId: string;
  selectedPanel: number;
}

const ChatRoomInfiniteLoader: FC<Props> = ({ roomId, selectedPanel }) => {
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
    // console.log('isItemLoaded', !!itemStatusMap[index]);
    return !!itemStatusMap[index];
  };

  const getApiItems = useCallback(
    (skip: number, limit: number) => {
      console.log(`get API items with skip ${skip} and limit ${limit}`);
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
    // for (let index = startIndex; index <= stopIndex; index++) {
    //   itemStatusMap[index] = LOADING;
    // }
    const limit = count - startIndex - data.length;
    debouncedGetApiItems(data.length, limit);
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        for (let index = startIndex; index <= stopIndex; index++) {
          itemStatusMap[index] = LOADED;
        }
        resolve(undefined);
        clearTimeout(timeout);
      }, timeoutAmount);
      return timeout;
    });
  };

  const Row = ({ index, style }: ListChildComponentProps) => {
    const rowItem = data[count - index - 1];
    const loading = !(itemStatusMap[index] === LOADED && rowItem);
    return (
      <div style={style as CSSProperties}>
        {loading ? (
          <ChatRoomBubbleSkeleton
            className={
              classes.bubble
              // selected.includes(item._id)
              //   ? clsx(classes.bubble, classes.bubbleSelected)
              //   : classes.bubble
            }
          />
        ) : (
          <ChatRoomBubble
            data={rowItem}
            className={
              classes.bubble
              // selected.includes(item._id)
              //   ? clsx(classes.bubble, classes.bubbleSelected)
              //   : classes.bubble
            }
            onLongPress={() => console.log('onLongPress')}
            onPress={() => console.log('onPress')}
            // key={index}
          />
        )}
      </div>
    );
  };

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
                  itemSize={52}
                  onItemsRendered={onItemsRendered}
                  ref={ref}
                  initialScrollOffset={count * 52}
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

export default ChatRoomInfiniteLoader;

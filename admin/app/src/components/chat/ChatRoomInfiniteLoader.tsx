import React, { CSSProperties, FC, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { asyncGetChatMessages } from '../../redux/slices/chatSlice';

interface ItemStatus {
  [key: string]: number;
}
const LOADING = 1;
const LOADED = 2;
const itemStatusMap: ItemStatus = {};

interface Props {
  roomId: string;
  selectedPanel: number;
}

const ChatRoomInfiniteLoader: FC<Props> = ({ roomId, selectedPanel }) => {
  const dispatch = useAppDispatch();
  const {
    chatMessages: { data, count },
  } = useAppSelector((state) => state.chatSlice.data);

  const infiniteLoaderRef = useRef<any>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    console.log('selectedPanel', selectedPanel);
    if (infiniteLoaderRef.current && hasMountedRef.current) {
      console.log('WORKING AS INTENDED');
      infiniteLoaderRef.current.resetloadMoreItemsCache(true);
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
    1000
  );

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    for (let index = startIndex; index <= stopIndex; index++) {
      itemStatusMap[index] = LOADING;
    }
    const limit = count - startIndex - data.length;
    debouncedGetApiItems(data.length, limit);
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        for (let index = startIndex; index <= stopIndex; index++) {
          itemStatusMap[index] = LOADED;
        }
        resolve(undefined);
        clearTimeout(timeout);
      }, 1000);
      return timeout;
    });
  };

  const Row = ({ index, style }: ListChildComponentProps) => {
    let label;
    if (itemStatusMap[index] === LOADED) {
      label = `${data[count - index - 1]?.message}`;
    } else {
      label = 'Loading...';
    }
    return (
      <div style={style as CSSProperties}>
        <div>{label}</div>
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
                  itemSize={30}
                  onItemsRendered={onItemsRendered}
                  ref={ref}
                  initialScrollOffset={count * 30}
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

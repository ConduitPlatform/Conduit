import React, { CSSProperties } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';
import { useAppSelector } from '../../redux/store';

interface ItemStatus {
  [key: string]: number;
}
const LOADING = 1;
const LOADED = 2;
const itemStatusMap: ItemStatus = {};

const isItemLoaded = (index: number) => {
  return !!itemStatusMap[index];
};

const ChatRoomInfiniteLoader = () => {
  const {
    chatMessages: { data, count },
  } = useAppSelector((state) => state.chatSlice.data);

  const getApiItems = () => {
    // console.log(`get API items with skip`);
  };

  const debouncedGetApiItems = debounce(getApiItems, 1000);

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    for (let index = startIndex; index <= stopIndex; index++) {
      itemStatusMap[index] = LOADING;
    }
    debouncedGetApiItems();
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
      <div className="ListItem" style={style as CSSProperties}>
        {label}
      </div>
    );
  };

  return (
    <AutoSizer>
      {({ height, width }) => {
        if (!count) return <div>Loading</div>;
        return (
          <InfiniteLoader
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

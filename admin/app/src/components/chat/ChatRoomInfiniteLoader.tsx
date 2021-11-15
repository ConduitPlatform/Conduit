import React, { CSSProperties } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { debounce } from 'lodash';

interface ItemStatus {
  [key: string]: number;
}
const LOADING = 1;
const LOADED = 2;
const itemStatusMap: ItemStatus = {};

const getApiItems = () => {
  // console.log(`get API items with skip`);
};

const debouncedGetApiItems = debounce(getApiItems, 1000);

const isItemLoaded = (index: number) => {
  return !!itemStatusMap[index];
};
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
    label = `Row ${100 - index}`;
  } else {
    label = 'Loading...';
  }
  return (
    <div className="ListItem" style={{ ...(style as CSSProperties) }}>
      {label}
    </div>
  );
};

const ChatRoomInfiniteLoader = () => {
  return (
    <AutoSizer>
      {({ height, width }) => (
        <InfiniteLoader isItemLoaded={isItemLoaded} itemCount={100} loadMoreItems={loadMoreItems}>
          {({ onItemsRendered, ref }) => (
            <List
              height={height}
              itemCount={100}
              itemSize={30}
              onItemsRendered={onItemsRendered}
              ref={ref}
              initialScrollOffset={100 * 30}
              width={width}>
              {Row}
            </List>
          )}
        </InfiniteLoader>
      )}
    </AutoSizer>
  );
};

export default ChatRoomInfiniteLoader;

import React, { CSSProperties, memo } from 'react';
import { areEqual, ListChildComponentProps } from 'react-window';
import ChatRoomBubble, { ChatRoomBubbleSkeleton } from './ChatRoomBubble';
import clsx from 'clsx';

const Row = memo(({ data, index, style }: ListChildComponentProps) => {
  const {
    messages,
    messagesCount,
    selectedMessages,
    onPress,
    onLongPress,
    classes,
    itemStatusMap,
  } = data;
  const rowItem = messages[messagesCount - index - 1];
  const loading = !(itemStatusMap[index] === 'LOADED' && rowItem);
  const isSelected = rowItem && selectedMessages.includes(rowItem._id);

  return (
    <div style={style as CSSProperties}>
      {loading ? (
        <ChatRoomBubbleSkeleton className={classes.bubble} />
      ) : (
        <ChatRoomBubble
          data={rowItem}
          className={isSelected ? clsx(classes.bubble, classes.bubbleSelected) : classes.bubble}
          onLongPress={onLongPress}
          onPress={onPress}
        />
      )}
    </div>
  );
}, areEqual);

Row.displayName = 'Row';

export default Row;

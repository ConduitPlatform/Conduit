import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Box from '@material-ui/core/Box';
import DragHandleIcon from '@material-ui/icons/DragHandle';
import Card from '@material-ui/core/Card';
import TextIcon from '@material-ui/icons/Title';
import ColorIcon from '@material-ui/icons/ColorLens';
import NumberIcon from '@material-ui/icons/Filter7';
import SelectIcon from '@material-ui/icons/FormatListBulleted';
import BooleanIcon from '@material-ui/icons/ToggleOn';
import DateIcon from '@material-ui/icons/DateRange';
import GroupIcon from '@material-ui/icons/PlaylistAdd';

const useStyles = makeStyles((theme) => ({
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    userSelect: 'none',
  },
  itemClone: {
    '&~div': {
      transform: 'none !important',
    },
  },
  icon: {
    marginRight: theme.spacing(1),
  },
}));

export default function BuildTypesList(props) {
  const { item, index, ...rest } = props;
  const classes = useStyles();

  const handleIcon = (item) => {
    switch (item) {
      case 'Text':
        return <TextIcon />;
      case 'Number':
        return <NumberIcon />;
      case 'Boolean':
        return <BooleanIcon />;
      case 'Select':
        return <SelectIcon />;
      case 'Color':
        return <ColorIcon />;
      case 'Date':
        return <DateIcon />;
      case 'Group':
        return <GroupIcon />;
      default:
        return <TextIcon />;
    }
  };

  const handleItem = (item) => {
    return (
      <>
        <Box display={'flex'} alignItems={'center'}>
          {handleIcon(item)}
          <Box ml={2}>{item}</Box>
        </Box>
        <DragHandleIcon style={{ fill: '#dce0e5' }} />
      </>
    );
  };

  return (
    <Draggable draggableId={item} index={index} isDraggingOver={false} {...rest}>
      {(provided, snapshot) => (
        <>
          <Card className={classes.item} ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
            {handleItem(item, index)}
          </Card>
          {snapshot.isDragging && <Card className={clsx(classes.item, classes.itemClone)}>{handleItem(item, index)}</Card>}
        </>
      )}
    </Draggable>
  );
}

import React, { FC } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Box from '@material-ui/core/Box';
import DragHandleIcon from '@material-ui/icons/DragHandle';
import Card from '@material-ui/core/Card';
import TextIcon from '@material-ui/icons/Title';
import CodeIcon from '@material-ui/icons/Code';
import DeviceHubIcon from '@material-ui/icons/DeviceHub';
import NumberIcon from '@material-ui/icons/Filter7';
import SelectIcon from '@material-ui/icons/FormatListBulleted';
import BooleanIcon from '@material-ui/icons/ToggleOn';
import DateIcon from '@material-ui/icons/DateRange';
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet';

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

interface Props {
  item: 'Text' | 'Number' | 'Date' | 'Boolean' | 'Enum' | 'ObjectId' | 'Relation';
  index: number;
}

const BuildTypesList: FC<Props> = ({ item, index, ...rest }) => {
  const classes = useStyles();

  const handleIcon = (item) => {
    switch (item) {
      case 'Text':
        return <TextIcon />;
      case 'Number':
        return <NumberIcon />;
      case 'Date':
        return <DateIcon />;
      case 'Boolean':
        return <BooleanIcon />;
      case 'Enum':
        return <SelectIcon />;
      case 'ObjectId':
        return <CodeIcon />;
      case 'Group':
        return <SettingsEthernetIcon />;
      case 'Relation':
        return <DeviceHubIcon />;
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
          <Card
            className={classes.item}
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}>
            {handleItem(item)}
          </Card>
          {snapshot.isDragging && (
            <Card className={clsx(classes.item, classes.itemClone)}>
              {handleItem(item)}
            </Card>
          )}
        </>
      )}
    </Draggable>
  );
};

export default BuildTypesList;

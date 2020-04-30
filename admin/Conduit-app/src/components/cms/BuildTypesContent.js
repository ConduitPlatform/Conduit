import React from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Content from '@material-ui/icons/PermMedia';
import Typography from '@material-ui/core/Typography';
import DeleteIcon from '@material-ui/icons/Delete';
import SettingsIcon from '@material-ui/icons/Settings';
import DragHandleIcon from '@material-ui/icons/DragHandle';
import SimpleType from './types/SimpleType/SimpleType';
import ColorType from './types/ColorType/ColorType';
import BooleanType from './types/BooleanType/BooleanType';
import SelectType from './types/SelectType/SelectType';
import GroupType from './types/GroupType/GroupType';

const useStyles = makeStyles((theme) => ({
  list: {
    height: '100%',
    border: '1px',
    background: '#fff',
    padding: theme.spacing(4, 10),
    minHeight: theme.spacing(65),
    borderRadius: '4px',
  },
  item: {
    display: 'flex',
    flexDirection: 'column-reverse',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderLeft: '1px solid #dce0e5',
  },
  icon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginLeft: theme.spacing(1),
    cursor: 'pointer',
  },
  listPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: theme.spacing(47),
    border: 'dashed 1px #667587',
  },
  listPlaceholderItems: {
    marginBottom: theme.spacing(2),
  },
}));

export default function BuildTypesContent(props) {
  const {
    dataKey,
    data,
    handleDrawer,
    handleDelete,
    handleGroupDelete,
    handleGroupDrawer,
    handleGroupInGroupDelete,
    handleGroupInGroupDrawer,
    ...rest
  } = props;
  const classes = useStyles();

  const handleItemContent = (item, index) => {
    switch (item.type) {
      case 'Text':
        return <SimpleType item={item} />;
      case 'Number':
        return <SimpleType item={item} />;
      case 'Date':
        return <SimpleType item={item} />;
      case 'Color':
        return <ColorType item={item} />;
      case 'Boolean':
        return <BooleanType item={item} />;
      case 'Select':
        return <SelectType item={item} />;
      case 'Group':
        return (
          <GroupType
            item={item}
            groupIndex={index}
            handleDelete={handleGroupDelete}
            handleDrawer={handleGroupDrawer}
            handleGroupDelete={handleGroupInGroupDelete}
            handleGroupDrawer={handleGroupInGroupDrawer}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box {...rest}>
      <Droppable droppableId={dataKey}>
        {(provided, snapshot) => (
          <Box className={classes.list} ref={provided.innerRef}>
            {data && Array.isArray(data[dataKey]) && data[dataKey].length > 0 ? (
              data[dataKey].map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided) => (
                    <Box className={classes.item} ref={provided.innerRef} {...provided.draggableProps}>
                      <Box width={'99%'}>{handleItemContent(item, index)}</Box>
                      <Box display={'flex'} flexDirection={'column'} width={'99%'} mb={2}>
                        <Box display={'flex'} width={'100%'} justifyContent={'space-between'}>
                          <Box display={'flex'}>
                            <Typography variant={'body2'} style={{ marginRight: 8 }}>
                              {item.name}
                            </Typography>
                            <Typography variant={'body2'}>API ID: {item.id}</Typography>
                          </Box>
                          <Box display={'flex'}>
                            <DeleteIcon className={classes.icon} onClick={() => handleDelete(index)} />
                            <SettingsIcon className={classes.icon} onClick={() => handleDrawer(item, index)} />
                            <Box {...provided.dragHandleProps} className={classes.icon}>
                              <DragHandleIcon />
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Draggable>
              ))
            ) : (
              <Box className={classes.listPlaceholder} style={snapshot.isDraggingOver ? { opacity: 0.4 } : {}}>
                <Content className={classes.listPlaceholderItems} />
                <Typography variant={'subtitle2'} className={classes.listPlaceholderItems}>
                  Simply drag and drop
                </Typography>
                <Typography variant={'body2'}>The fields or elements you want in this custom type</Typography>
              </Box>
            )}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Box>
  );
}

import Box from "@material-ui/core/Box";
import {Draggable, Droppable} from "react-beautiful-dnd";
import Typography from "@material-ui/core/Typography";
import DeleteIcon from "@material-ui/icons/Delete";
import SettingsIcon from "@material-ui/icons/Settings";
import React from "react";
import {makeStyles} from "@material-ui/core/styles";
import {SimpleGroupType} from "../SimpleType/SimpleType";
import {ColorGroupType} from "../ColorType/ColorType";
import {BooleanGroupType} from "../BooleanType/BooleanType";
import {SelectGroupType} from "../SelectType/SelectType";

const useStyles = makeStyles(theme => ({
  root: {
    minHeight: 100,
    width: '100%',
    border: '1px dotted black',
    backgroundColor: theme.palette.grey['100']
  },
  rootDragging: {
    minHeight: 100,
    width: '100%',
    backgroundColor: theme.palette.grey['500']
  },
  icon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginLeft: theme.spacing(1),
    cursor: 'pointer'
  },
  item: {
    display: 'flex',
    flexDirection: 'column-reverse',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

export function GroupGroupType(props) {
  const {item, groupIndex, itemIndex, handleGroupDelete, handleGroupDrawer, ...rest} = props;
  const classes = useStyles();

  const handleGroupContent = (item) => {
    switch (item.type) {
      case 'Text':
        return <SimpleGroupType item={item}/>;
      case 'Number':
        return <SimpleGroupType item={item}/>;
      case 'Date':
        return <SimpleGroupType item={item}/>;
      case 'Color':
        return <ColorGroupType item={item}/>;
      case 'Boolean':
        return <BooleanGroupType item={item}/>;
      case 'Select':
        return <SelectGroupType item={item}/>;
      default:
        return null
    }
  };

  const groupId = `child-${item.id}`;

  return (
    <Box style={{width: '100%'}} {...rest}>
      <Droppable droppableId={groupId} isCombineEnabled>
        {(provided, snapshot) => (
          <Box ref={provided.innerRef} className={snapshot.isDraggingOver ? classes.rootDragging : classes.root}>
            {item.content && Array.isArray(item.content) && item.content.length > 0 ? item.content.map((groupItem, index) => {
              return (
              <Draggable
                key={groupItem.id}
                draggableId={groupItem.id}
                index={index}
                isDragDisabled>
                {(provided) => (
                  <Box
                    className={classes.item}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}>
                    <Box width={'99%'}>
                      {handleGroupContent(groupItem)}
                    </Box>
                    <Box display={'flex'} flexDirection={'column'} width={'99%'} mb={2}>
                      <Box display={'flex'} width={'100%'} justifyContent={'space-between'}>
                        <Box display={'flex'}>
                          <Typography variant={'body2'} style={{marginRight: 8}}>{groupItem.name}</Typography>
                          <Typography variant={'body2'}>API ID: {groupItem.id}</Typography>
                        </Box>
                        <Box display={'flex'}>
                          <DeleteIcon className={classes.icon} onClick={() => handleGroupDelete(index, groupIndex, itemIndex)}/>
                          <SettingsIcon className={classes.icon} onClick={() => handleGroupDrawer(groupItem, index, groupIndex, itemIndex)}/>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Draggable>
            )}) : <Box>Place items</Box>}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Box>
  );
}

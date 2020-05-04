import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import Typography from '@material-ui/core/Typography';
import DeleteIcon from '@material-ui/icons/Delete';
import SettingsIcon from '@material-ui/icons/Settings';
import { SimpleGroupType } from '../SimpleType/SimpleType';
import { BooleanGroupType } from '../BooleanType/BooleanType';
import { GroupGroupType } from './GroupTypeChild';
import FieldIndicators from '../../FieldIndicators';
import GroupIcon from '@material-ui/icons/PlaylistAdd';
import Tooltip from '@material-ui/core/Tooltip';
import { EnumGroupType } from '../EnumType/EnumType';
import { ObjectIdGroupType } from '../ObjectIdType/ObjectIdType';
import { RelationGroupType } from '../RelationType/RelationType';
import Grid from '@material-ui/core/Grid';

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: 300,
    width: '100%',
    border: '1px dotted black',
    backgroundColor: theme.palette.grey['100'],
  },
  rootDragging: {
    minHeight: 300,
    width: '100%',
    backgroundColor: theme.palette.grey['500'],
  },
  icon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginLeft: theme.spacing(1),
    cursor: 'pointer',
  },
  groupIcon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginRight: theme.spacing(1),
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
  },
  item: {
    display: 'flex',
    flexDirection: 'column-reverse',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

export default function GroupType(props) {
  const { item, groupIndex, handleDelete, handleDrawer, handleGroupDelete, handleGroupDrawer, ...rest } = props;
  const classes = useStyles();

  const handleGroupContent = (item, index) => {
    switch (item.type) {
      case 'Text':
        return item.isEnum ? <EnumGroupType item={item} /> : <SimpleGroupType item={item} />;
      case 'Number':
        return item.isEnum ? <EnumGroupType item={item} /> : <SimpleGroupType item={item} />;
      case 'Date':
        return <SimpleGroupType item={item} />;
      case 'ObjectId':
        return <ObjectIdGroupType item={item} />;
      case 'Boolean':
        return <BooleanGroupType item={item} />;
      case 'Relation':
        return <RelationGroupType item={item} />;
      case 'Group':
        return (
          <GroupGroupType
            item={item}
            groupIndex={groupIndex}
            itemIndex={index}
            handleGroupDelete={handleGroupDelete}
            handleGroupDrawer={handleGroupDrawer}
          />
        );
      default:
        return null;
    }
  };

  const groupId = `group-${item.name}`;

  return (
    <Box style={{ width: '100%' }} {...rest}>
      <Grid container>
        <Grid container item xs={6} alignItems={'center'}>
          <Box display={'flex'} alignItems={'center'}>
            <Tooltip title={'Group field'}>
              <GroupIcon className={classes.groupIcon} />
            </Tooltip>
          </Box>
        </Grid>
        <Grid container item xs={6} alignItems={'center'} justify={'flex-end'}>
          <Box display={'flex'} alignItems={'center'}>
            <FieldIndicators item={item} />
          </Box>
        </Grid>
      </Grid>
      <Droppable droppableId={groupId} isCombineEnabled>
        {(provided, snapshot) => (
          <Box ref={provided.innerRef} className={snapshot.isDraggingOver ? classes.rootDragging : classes.root}>
            {item.content && Array.isArray(item.content) && item.content.length > 0 ? (
              item.content.map((groupItem, index) => (
                <Draggable key={groupItem.name} draggableId={groupItem.name} index={index} isDragDisabled>
                  {(provided) => (
                    <Box
                      className={classes.item}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}>
                      <Box width={'99%'}>{handleGroupContent(groupItem, index)}</Box>
                      <Box display={'flex'} flexDirection={'column'} width={'99%'} mb={2}>
                        <Box display={'flex'} width={'100%'} justifyContent={'space-between'}>
                          <Box display={'flex'}>
                            <Typography variant={'body2'} style={{ marginRight: 8 }}>
                              {groupItem.name}
                            </Typography>
                          </Box>
                          <Box display={'flex'}>
                            <DeleteIcon className={classes.icon} onClick={() => handleDelete(index, groupIndex)} />
                            <SettingsIcon className={classes.icon} onClick={() => handleDrawer(groupItem, index, groupIndex)} />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Draggable>
              ))
            ) : (
              <Box>Place items</Box>
            )}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Box>
  );
}

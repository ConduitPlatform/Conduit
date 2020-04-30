import React, { useState } from 'react';
import { DragDropContext, Droppable, resetServerContext } from 'react-beautiful-dnd';
import { renderToString } from 'react-dom/server';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import BuildTypesList from '../../components/cms/BuildTypesList';
import BuildTypesContent from '../../components/cms/BuildTypesContent';
import BuildTypesDrawer from '../../components/cms/BuildTypesDrawer';
import Header from '../../components/cms/Header';
import { headerHeight } from '../../components/cms/Header';
import {
  cloneItem,
  addToGroup,
  addToChildGroup,
  updateItem,
  updateGroupItem,
  updateGroupChildItem,
  reorderItems,
  deleteItem,
} from '../../utils/type-functions';

const items = ['Text', 'Number', 'Date', 'Boolean', 'Select', 'Color', 'Group'];

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: '100vh',
    backgroundColor: '#f5f6f9',
  },
  cmsContainer: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'space-between',
  },
  contentContainer: {
    width: '75%',
    display: 'flex',
    padding: theme.spacing(2, 14),
    justifyContent: 'center',
    paddingTop: headerHeight,
  },
  listContainer: {
    height: `calc(100vh - ${headerHeight}px)`,
    width: '25%',
    backgroundColor: '#f9f9fb',
    padding: theme.spacing(2),
    position: 'fixed',
    top: headerHeight,
    right: 0,
    bottom: 0,
  },
  list: {
    width: '100%',
    height: '100%',
    border: '1px',
    background: '#fff',
    borderRadius: 4,
  },
}));

export default function BuildTypes(props) {
  const { clientName = 'Home Page', clientId = 'home_page' } = props;
  const classes = useStyles();

  resetServerContext();
  renderToString(BuildTypes);

  const [data, setData] = useState({ [clientId]: [] });

  const [drawerData, setDrawerData] = useState({ open: false, type: '', destination: {} });

  const [duplicateId, setDuplicateId] = useState(false);

  const [selectedProps, setSelectedProps] = useState({ item: undefined, index: undefined, type: 'standard' });

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    if (source.droppableId === destination.droppableId) {
      setData({
        [clientId]: reorderItems(data[source.droppableId], source.index, destination.index),
      });
    }

    let droppableIdString = `${destination.droppableId}`;
    let groupIsGroupChild = droppableIdString.slice(0, 5);

    if (draggableId === 'Group' && groupIsGroupChild === 'child') {
      return;
    }

    if (source.droppableId === 'ITEMS') {
      setDrawerData({ ...drawerData, open: true, type: items[source.index], destination: destination });
    }
  };

  const handleDrawerClose = () => {
    setDrawerData({ ...drawerData, open: false });
    setSelectedProps({ ...selectedProps, item: undefined });
    setDuplicateId(false);
  };

  const handleSubmit = (event, typeData) => {
    const array = data[clientId];

    if (!Array.isArray(array)) {
      return;
    }

    const hasDuplicate = array.some((item) => {
      if (selectedProps.item) {
        if (selectedProps.item.id === item.id) {
          return false;
        }
      }
      if (item.content) {
        let flag = false;
        item.content.some((item2) => {
          if (item2.id === typeData.id) {
            flag = true;
          }
          if (item2.content) {
            let flag2 = false;
            item2.content.some((item3) => {
              if (item3.id === typeData.id) {
                flag2 = true;
              }
            });
            if (flag2) flag = true;
          }
        });
        if (flag) return true;
      }
      return item.id === typeData.id;
    }); //sad times

    if (hasDuplicate) {
      setDuplicateId(true);
      return;
    }

    setDuplicateId(false);

    let droppableIdString = `${drawerData.destination.droppableId}`;
    let isGroup = droppableIdString.slice(0, 5);
    let groupId = droppableIdString.substr(6);

    if (selectedProps.item) {
      if (selectedProps.type === 'standard') {
        setData({
          [clientId]: updateItem(data[clientId], typeData, selectedProps.index),
        });
      }

      if (selectedProps.type === 'group') {
        setData({
          [clientId]: updateGroupItem(data[clientId], groupId, typeData, selectedProps.index),
        });
      }

      if (selectedProps.type === 'group-child') {
        setData({
          [clientId]: updateGroupChildItem(data[clientId], groupId, typeData, selectedProps.index),
        });
      }
    } else if (isGroup === 'group') {
      setData({
        [clientId]: addToGroup(data[clientId], groupId, typeData, drawerData.destination),
      });
    } else if (isGroup === 'child') {
      setData({
        [clientId]: addToChildGroup(data[clientId], groupId, typeData, drawerData.destination),
      });
    } else {
      setData({
        [clientId]: cloneItem(data[clientId], typeData, drawerData.destination),
      });
    }

    handleDrawerClose();
    event.preventDefault();
  };

  const handleDrawer = (item, index) => {
    setSelectedProps({ item: item, index: index, type: 'standard' });
    setDrawerData({ ...drawerData, open: true, type: data[clientId][index].type });
  };

  const handleDelete = (index) => {
    setData({
      [clientId]: deleteItem(data[clientId], index),
    });
  };

  const handleGroupDrawer = (item, index, groupIndex) => {
    setSelectedProps({ item: item, index: index, type: 'group' });
    setDrawerData({ ...drawerData, open: true, type: data[clientId][groupIndex].content[index].type });
  };

  const handleGroupDelete = (index, groupIndex) => {
    const deleted = Array.from(data[clientId]);
    deleted[groupIndex].content.splice(index, 1);
    setData({
      [clientId]: deleted,
    });
  };

  const handleGroupInGroupDrawer = (item, index, groupIndex, itemIndex) => {
    setSelectedProps({ item: item, index: index, type: 'group-child' });
    setDrawerData({ ...drawerData, open: true, type: data[clientId][groupIndex].content[itemIndex].content[index].type });
  };

  const handleGroupInGroupDelete = (index, groupIndex, itemIndex) => {
    const deleted = Array.from(data[clientId]);
    deleted[groupIndex].content[itemIndex].content.splice(index, 1);
    setData({
      [clientId]: deleted,
    });
  };

  const handleSave = (name, type) => {
    console.log('name', name);
    console.log('type', type);
    setData({ [clientId]: [] });
  };

  return (
    <Box className={classes.root}>
      <Header name={clientName} handleSave={handleSave} />
      <Box className={classes.cmsContainer}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Box className={classes.contentContainer}>
            {data &&
              Object.keys(data).map((dataKey) => (
                <BuildTypesContent
                  dataKey={dataKey}
                  data={data}
                  handleDelete={handleDelete}
                  handleDrawer={handleDrawer}
                  handleGroupDelete={handleGroupDelete}
                  handleGroupDrawer={handleGroupDrawer}
                  handleGroupInGroupDelete={handleGroupInGroupDelete}
                  handleGroupInGroupDrawer={handleGroupInGroupDrawer}
                  key={dataKey}
                  style={{ width: '100%' }}
                />
              ))}
          </Box>
          <Box className={classes.listContainer}>
            <Droppable droppableId="ITEMS" isDropDisabled={true}>
              {(provided) => (
                <Box className={classes.list} ref={provided.innerRef}>
                  {items.map((item, index) => (
                    <BuildTypesList item={item} index={index} key={item} />
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </Box>
        </DragDropContext>
      </Box>
      <BuildTypesDrawer
        drawerData={drawerData}
        duplicateId={duplicateId}
        selectedItem={selectedProps.item}
        onClose={handleDrawerClose}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}

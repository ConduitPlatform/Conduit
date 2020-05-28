import Box from '@material-ui/core/Box';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Container from '@material-ui/core/Container';
import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import TreeView from '@material-ui/lab/TreeView';
import TreeItem from '@material-ui/lab/TreeItem';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import CardHeader from '@material-ui/core/CardHeader';
import IconButton from '@material-ui/core/IconButton';
import { MoreVert } from '@material-ui/icons';
import CardContent from '@material-ui/core/CardContent';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '300px',
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  grid: {
    marginBottom: theme.spacing(3),
  },
  multiline: {
    width: '100%',
  },
  textField: {
    width: '95%',
  },
  tree: {
    flexGrow: 1,
    maxWidth: 400,
  },
  'Mui-selected': {
    background: 'none',
    '&:hover': {
      background: 'none !important',
    },
  },
  card: {
    margin: theme.spacing(1),
  },
  cardContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    flex: 1,
  },
  bold: {
    fontWeight: 'bold',
  },
  emptyDocuments: {
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  deleteButton: {
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.common.white,
  },
}));

const TabPanel = (props) => {
  const classes = useStyles();
  const { children } = props;

  return <Box className={classes.cardContainer}>{children}</Box>;
};

const ITEM_HEIGHT = 48;
const options = ['edit', 'delete'];

const SchemaData = ({ schemas, documents, handleSchemaChange }) => {
  const classes = useStyles();
  const [selectedSchema, setSelectedSchema] = useState(0);
  const [docIndex, setDocIndex] = useState(null);
  const [createIndex, setCreateIndex] = useState(null);
  const [docAction, setDocAction] = useState('');
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const [dialog, setDialog] = useState(false);

  const [objFields, setObjFields] = useState([]);

  const handleClick = (event, idx) => {
    setDocIndex(idx);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (event, newValue) => {
    setDocAction('');
    setSelectedSchema(newValue);
    const name = schemas[newValue].name;
    handleSchemaChange(name);
  };

  const createDocumentArray = (document) => {
    return Object.keys(document).map((key) => {
      return { id: key, data: document[key] };
    });
  };

  const renderTree = (nodes) => {
    return (
      <TreeItem
        key={nodes.id}
        nodeId={nodes.id}
        label={
          <Typography variant={'subtitle2'}>
            <Typography component={'span'} className={classes.bold}>{`${nodes.id}: `}</Typography>
            {Array.isArray(nodes.data)
              ? nodes.data.length > 0
                ? '[...]'
                : '[ ]'
              : typeof nodes.data !== 'string' && nodes.data && Object.keys(nodes.data).length > 0
              ? '{...}'
              : `${nodes.data}`}
          </Typography>
        }>
        {Array.isArray(nodes.data)
          ? nodes.data.map((node, index) => renderTree({ id: index.toString(), data: node }))
          : typeof nodes.data !== 'string' && nodes.data && Object.keys(nodes.data).length > 0
          ? createDocumentArray(nodes.data).map((node) => renderTree(node))
          : null}
      </TreeItem>
    );
  };

  const renderEditTree = (nodes) => {
    return (
      <TreeItem
        key={nodes.name}
        nodeId={nodes.name}
        label={
          <Typography variant={'subtitle2'} style={{ display: 'flex', alignItems: 'center', marginBottom: '.5rem' }}>
            <Typography component={'span'} className={classes.bold}>{`${nodes.name}: `}</Typography>
            {typeof nodes.type === 'string' ? (
              <TextField
                id={nodes.name}
                required={nodes.required}
                type={nodes.type}
                onChange={(event) => handleTextChange(event, nodes.name)}
                size={'small'}
                variant={'outlined'}
                style={{ width: '30vw', zIndex: '1020' }}
                value={nodes.value}
              />
            ) : null}
          </Typography>
        }>
        {nodes.type && typeof nodes.type !== 'string'
          ? nodes.type.map((item) => {
              return renderEditTree(item);
            })
          : null}
      </TreeItem>
    );
  };

  const handleTextChange = (event, objName) => {
    const found = objFields.find((obj) => obj.name === objName);
    if (found) {
      found.value = event.target.value;
    }
  };

  const onSelectAction = (option) => {
    handleClose();
    if (option === 'edit') {
      setDocAction('edit');
      const arrFields = getFields(schemas[selectedSchema].fields, 'edit');
      setObjFields([...arrFields]);
    } else if (option === 'delete') {
      setDocAction('delete');
      openDialog(docIndex);
    }
  };

  const cancelEditDocument = () => {
    setDocAction('');
    setObjFields([]);
    setCreateIndex(null);
  };

  const addNewDocument = () => {
    setDocAction('create');
    setCreateIndex(selectedSchema);
    const arrFields = getFields(schemas[selectedSchema].fields, 'create');
    setObjFields([...arrFields]);
  };

  const getFields = (fields, action) => {
    const editFields = [];
    Object.keys(fields).forEach((item) => {
      if (typeof fields[item] !== 'string') {
        if (typeof fields[item].type === 'string') {
          const value = action === 'edit' ? documents[docIndex][item] : null;
          const obj = { name: item.toString(), ...fields[item], value: action === 'edit' ? value : fields[item].default };
          editFields.push(obj);
        } else {
          const group = { name: item.toString(), type: getFields(fields[item].type, action) };
          editFields.push(group);
        }
      }
    });
    return editFields;
  };

  const closeDialog = () => {
    setDialog(false);
  };

  const openDialog = () => {
    setDialog(true);
  };

  const handleDelete = () => {
    //  todo handle delete document API call
  };

  const handleCreateDocument = () => {
    // TODO API call redux (actions etc...)
    console.log('Schema id, name ', schemas[createIndex]._id, schemas[createIndex].name);
    console.log('SAVE CREATE DOCUMENT', objFields);
  };

  return (
    <Container>
      <Box className={classes.root}>
        <Tabs
          value={selectedSchema}
          onChange={handleChange}
          orientation="vertical"
          variant="scrollable"
          aria-label="Vertical tabs"
          className={classes.tabs}>
          {schemas.map((d, index) => {
            return <Tab key={`tabs${index}`} label={d.name} />;
          })}
        </Tabs>

        <TabPanel value={selectedSchema}>
          {documents.length > 0 || docAction === 'create' ? (
            <>
              {docAction !== 'edit' && docAction !== 'create' && (
                <Button
                  key={`btn_${documents.length - 1}`}
                  variant="contained"
                  color="primary"
                  style={{ alignSelf: 'flex-end', margin: '.5rem' }}
                  onClick={() => addNewDocument()}>
                  Add Document
                </Button>
              )}
              {docAction === '' || docAction === 'delete' ? (
                documents.map((doc, index) => {
                  return (
                    <Card key={`card${index}`} className={classes.card} variant={'outlined'}>
                      <CardHeader
                        title={doc._id}
                        action={
                          <>
                            <IconButton aria-label="settings" onClick={(event) => handleClick(event, index)}>
                              <MoreVert />
                            </IconButton>
                          </>
                        }
                      />
                      <CardContent>
                        {createDocumentArray(doc).map((obj, index) => {
                          return (
                            <TreeView
                              key={`treeView${index}`}
                              className={classes.tree}
                              defaultCollapseIcon={<ExpandMoreIcon />}
                              defaultExpanded={['root']}
                              defaultExpandIcon={<ChevronRightIcon />}>
                              {renderTree(obj)}
                            </TreeView>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })
              ) : docAction === 'create' ? (
                <Card key={`card_CreateNew`} className={classes.card} variant={'outlined'}>
                  <CardHeader
                    title={`Schema: ${schemas[createIndex].name}`}
                    action={
                      <>
                        <Button
                          key={`btn_Cancel_Insert`}
                          variant="contained"
                          color="primary"
                          style={{ alignSelf: 'flex-end', margin: '.5rem' }}
                          onClick={cancelEditDocument}>
                          Cancel
                        </Button>
                        <Button
                          key={`btn_Save_Create`}
                          onClick={handleCreateDocument}
                          variant="contained"
                          color="primary"
                          style={{ alignSelf: 'flex-end', margin: '.5rem' }}>
                          Save
                        </Button>
                      </>
                    }
                  />
                  <CardContent>
                    {objFields.map((obj, index) => {
                      return (
                        <TreeView
                          aria-selected={false}
                          key={`treeView${index}`}
                          className={classes.tree}
                          defaultCollapseIcon={<ExpandMoreIcon />}
                          defaultExpanded={['root']}
                          defaultExpandIcon={<ChevronRightIcon />}>
                          {renderEditTree(obj)}
                        </TreeView>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : (
                <Card key={`card${docIndex}`} className={classes.card} variant={'outlined'}>
                  <CardHeader
                    title={documents[docIndex]._id}
                    action={
                      <>
                        <Button
                          key={`btn_Cancel_${documents[docIndex]}`}
                          variant="contained"
                          color="primary"
                          style={{ alignSelf: 'flex-end', margin: '.5rem' }}
                          onClick={cancelEditDocument}>
                          Cancel
                        </Button>
                        <Button
                          key={`btn_Save_${documents[docIndex]}`}
                          variant="contained"
                          color="primary"
                          style={{ alignSelf: 'flex-end', margin: '.5rem' }}>
                          Save
                        </Button>
                      </>
                    }
                  />
                  <CardContent>
                    {objFields.map((obj, index) => {
                      return (
                        <TreeView
                          key={`treeView${index}`}
                          className={classes.tree}
                          defaultCollapseIcon={<ExpandMoreIcon />}
                          defaultExpanded={['root']}
                          defaultExpandIcon={<ChevronRightIcon />}>
                          {renderEditTree(obj)}
                        </TreeView>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              <Box className={classes.emptyDocuments}>
                <p>No documents are availables.</p>
                <Button variant="contained" color="primary" onClick={() => addNewDocument()}>
                  Add Document
                </Button>
              </Box>
            </>
          )}
        </TabPanel>
      </Box>
      <Dialog fullWidth={false} maxWidth={'md'} open={dialog} onClose={handleClose}>
        <DialogTitle id="new-custom-type" style={{ marginBottom: 16 }}>
          Delete document : {documents[docIndex]?._id}
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => closeDialog()} variant="contained" style={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} className={classes.deleteButton} variant="contained" style={{ textTransform: 'none' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        id="long-menu"
        anchorEl={anchorEl}
        keepMounted
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 4.5,
            width: '20ch',
          },
        }}>
        {options.map((option) => (
          <MenuItem key={option} selected={option === 'Pyxis'} onClick={() => onSelectAction(option)}>
            {option}
          </MenuItem>
        ))}
      </Menu>
    </Container>
  );
};

export default SchemaData;

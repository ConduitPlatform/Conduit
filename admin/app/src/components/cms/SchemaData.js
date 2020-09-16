import Box from '@material-ui/core/Box';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Container from '@material-ui/core/Container';
import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import TreeView from '@material-ui/lab/TreeView';
import TreeItem from '@material-ui/lab/TreeItem';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import CardHeader from '@material-ui/core/CardHeader';
import IconButton from '@material-ui/core/IconButton';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import { MoreVert } from '@material-ui/icons';
import CardContent from '@material-ui/core/CardContent';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import CreateDialog from './DocumentCreateDialog';
import { createSchemaDocument, deleteSchemaDocument, editSchemaDocument } from '../../redux/thunks/cmsThunks';

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
  addDocBox: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
  deleteButton: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
}));

const TabPanel = ({ children }) => {
  const classes = useStyles();
  return <Box className={classes.cardContainer}>{children}</Box>;
};

const ITEM_HEIGHT = 48;

const SchemaData = ({ schemas, schemaDocuments, handleSchemaChange }) => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const [selectedSchema, setSelectedSchema] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [docIndex, setDocIndex] = useState(null);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDocument, setCreateDocument] = useState(false);
  const [documents, setDocuments] = useState([]);

  const open = Boolean(anchorEl);

  useEffect(() => {
    if (schemaDocuments && schemaDocuments.documents) {
      setDocuments(schemaDocuments.documents);
    }
    return () => {};
  }, [schemaDocuments]);

  const handleCreateDialog = (create) => {
    if (!create) {
      setSelectedDocument(null);
    }
    setCreateDocument(!createDocument);
  };

  const handleClick = (event, idx) => {
    setDocIndex(idx);
    setAnchorEl(event.currentTarget);
  };

  const handleConfirmationDialogClose = () => {
    setDeleteDialogOpen(false);
    setDocIndex(null);
    setAnchorEl(null);
  };

  const handleChange = (event, newValue) => {
    setSelectedSchema(newValue);
    const name = schemas[newValue].name;
    handleSchemaChange(name);
  };

  const createDocumentArray = (document) => {
    return Object.keys(document).map((key) => {
      return { id: key, data: document[key] };
    });
  };

  const handleEditClick = () => {
    setAnchorEl(null);
    const currentSelectedDocument = documents[docIndex];
    setSelectedDocument(currentSelectedDocument);
    setCreateDocument(true);
    // setDocIndex(null);
  };

  const handleDeleteClick = () => {
    setAnchorEl(null);
    setDeleteDialogOpen(true);
  };

  const handleMenuClose = () => {
    setDocIndex(null);
    setAnchorEl(null);
  };

  const addNewDocument = () => {
    handleCreateDialog(true);
  };

  const handleCloseDeleteConfirmationDialog = () => {
    setDocIndex(null);
    setAnchorEl(null);
    setDeleteDialogOpen(false);
  };

  const handleDelete = () => {
    const _id = documents[docIndex]._id;
    const schemaName = schemas[selectedSchema].name;
    dispatch(deleteSchemaDocument(schemaName, _id));
    handleCloseDeleteConfirmationDialog();
  };

  const handleCreateDocument = (schemaName, document) => {
    dispatch(createSchemaDocument(schemaName, document));
    setCreateDocument(false);
  };

  const handleEditDocument = (schemaName, document) => {
    const _id = selectedDocument._id;
    dispatch(editSchemaDocument(schemaName, _id, document));
    setCreateDocument(false);
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
          {documents.length > 0 ? (
            <>
              {documents.map((doc, index) => {
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
              })}
              <Box className={classes.addDocBox}>
                <Button variant="contained" color="primary" onClick={() => addNewDocument()}>
                  Add Document
                </Button>
              </Box>
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
      <Dialog open={createDocument} onClose={() => handleCreateDialog(false)} maxWidth={'md'} fullWidth={true}>
        <CreateDialog
          schema={schemas[selectedSchema]}
          handleCreate={handleCreateDocument}
          handleEdit={handleEditDocument}
          handleCancel={() => handleCreateDialog(false)}
          editData={selectedDocument}
        />
      </Dialog>
      <Dialog fullWidth maxWidth={'sm'} open={deleteDialogOpen} onClose={handleConfirmationDialogClose}>
        <DialogTitle id="new-custom-type" style={{ marginBottom: 16 }}>
          Delete document : {documents[docIndex]?._id}
        </DialogTitle>
        <DialogActions>
          <Button onClick={handleCloseDeleteConfirmationDialog} variant="contained" style={{ textTransform: 'none' }}>
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
        onClose={handleMenuClose}
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 4.5,
            width: '20ch',
          },
        }}>
        <MenuItem onClick={handleEditClick}>Edit</MenuItem>
        <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
      </Menu>
    </Container>
  );
};

export default SchemaData;

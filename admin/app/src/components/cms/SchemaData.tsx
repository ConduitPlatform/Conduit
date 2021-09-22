import Box from '@material-ui/core/Box';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Container from '@material-ui/core/Container';
import React, { FC, useState } from 'react';
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
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  asyncCreateSchemaDocument,
  asyncDeleteSchemaDocument,
  asyncEditSchemaDocument,
  asyncGetMoreSchemaDocuments,
} from '../../redux/slices/cmsSlice';
import { Schema } from '../../models/cms/CmsModels';

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

interface Props {
  schemas: Schema[];
  handleSchemaChange: any;
}

const SchemaData: FC<Props> = ({ schemas, handleSchemaChange }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { documents } = useAppSelector((state) => state.cmsSlice?.data.documents);
  const documentsObj = useAppSelector((state) => state.cmsSlice.data?.documents);

  const [selectedSchema, setSelectedSchema] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [docIndex, setDocIndex] = useState(null);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDocument, setCreateDocument] = useState(false);

  const open = Boolean(anchorEl);

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
    setSelectedDocument(null);
    handleCreateDialog(true);
  };

  const handleCloseDeleteConfirmationDialog = () => {
    setDocIndex(null);
    setAnchorEl(null);
    setDeleteDialogOpen(false);
  };

  const handleDelete = () => {
    const documentId = documents[docIndex]._id;
    const schemaName = schemas[selectedSchema].name;
    dispatch(asyncDeleteSchemaDocument({ schemaName, documentId }));
    handleCloseDeleteConfirmationDialog();
  };

  const handleCreateDocument = (schemaName: string, document) => {
    dispatch(asyncCreateSchemaDocument({ schemaName, document }));
    setCreateDocument(false);
  };

  const handleEditDocument = (schemaName: string, document) => {
    const _id = selectedDocument._id;
    dispatch(
      asyncEditSchemaDocument({ schemaName, documentId: _id, documentData: document })
    );
    setCreateDocument(false);
  };

  const renderTree = (nodes) => {
    return (
      <TreeItem
        key={nodes.id}
        nodeId={nodes.id}
        label={
          <Typography variant={'subtitle2'}>
            <Typography
              component={'span'}
              className={classes.bold}>{`${nodes.id}: `}</Typography>
            {Array.isArray(nodes.data)
              ? nodes.data.length > 0
                ? '[...]'
                : '[ ]'
              : typeof nodes.data !== 'string' &&
                nodes.data &&
                Object.keys(nodes.data).length > 0
              ? '{...}'
              : `${nodes.data}`}
          </Typography>
        }>
        {Array.isArray(nodes.data)
          ? nodes.data.map((node, index) =>
              renderTree({ id: index.toString(), data: node })
            )
          : typeof nodes.data !== 'string' &&
            nodes.data &&
            Object.keys(nodes.data).length > 0
          ? createDocumentArray(nodes.data).map((node) => renderTree(node))
          : null}
      </TreeItem>
    );
  };

  const onViewMorePress = () => {
    const schemaName = schemas[selectedSchema].name;

    const documentLength = documents.length;
    // const documentsCount = schemaDocuments.documentsCount;
    // console.log(documentLength, documentsCount);
    dispatch(asyncGetMoreSchemaDocuments({ name: schemaName, skip: documentLength }));
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
                  <Card
                    key={`card${index}`}
                    className={classes.card}
                    variant={'outlined'}>
                    <CardHeader
                      title={doc._id}
                      action={
                        <>
                          <IconButton
                            aria-label="settings"
                            onClick={(event) => handleClick(event, index)}>
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
                <Button
                  style={{ marginRight: 15 }}
                  color="primary"
                  variant={'outlined'}
                  disabled={documentsObj?.documentsCount === documents.length}
                  onClick={onViewMorePress}>
                  View More documents
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => addNewDocument()}>
                  Add Document
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Box className={classes.emptyDocuments}>
                <p>No documents are availables.</p>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => addNewDocument()}>
                  Add Document
                </Button>
              </Box>
            </>
          )}
        </TabPanel>
      </Box>
      <Dialog
        open={createDocument}
        onClose={() => handleCreateDialog(false)}
        maxWidth={'md'}
        fullWidth={true}>
        <CreateDialog
          schema={schemas[selectedSchema]}
          handleCreate={handleCreateDocument}
          handleEdit={handleEditDocument}
          handleCancel={() => handleCreateDialog(false)}
          editData={selectedDocument}
        />
      </Dialog>
      <Dialog
        fullWidth
        maxWidth={'sm'}
        open={deleteDialogOpen}
        onClose={handleConfirmationDialogClose}>
        <DialogTitle id="new-custom-type" style={{ marginBottom: 16 }}>
          Delete document : {documents[docIndex]?._id}
        </DialogTitle>
        <DialogActions>
          <Button
            onClick={handleCloseDeleteConfirmationDialog}
            variant="contained"
            style={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            className={classes.deleteButton}
            variant="contained"
            style={{ textTransform: 'none' }}>
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

import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/navigation/Layout';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import CustomTabs from '../../components/common/CustomTabs';
import { privateRoute } from '../../components/utils/privateRoute';
import SchemasTable from '../../components/cms/SchemasTable';
import NewSchemaDialog from '../../components/cms/NewSchemaDialog';
import DisableSchemaDialog from '../../components/cms/DisableSchemaDialog';
import { useRouter } from 'next/router';
import SchemaData from '../../components/cms/SchemaData';
import { useDispatch, useSelector } from 'react-redux';
import { getCmsSchemas } from '../../redux/thunks';
import Snackbar from '@material-ui/core/Snackbar';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import { setSelectedSchema } from '../../redux/actions';
import {
  toggleSchema,
  deleteSelectedSchema,
  getSchemaDocuments,
  deleteCustomEndpoints,
  createCustomEndpoints,
  updateCustomEndpoints,
  getCustomEndpoints,
  getMoreCmsSchemas,
} from '../../redux/thunks/cmsThunks';
import CustomQueries from '../../components/cms/custom-endpoints/CustomQueries';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
  moreButton: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 15,
  },
}));

const Types = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const classes = useStyles();

  const { data, loading, error } = useSelector((state) => state.cmsReducer);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [openDisable, setOpenDisable] = useState(false);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedSchemaForAction, setSelectedSchemaForAction] = useState({
    data: {},
    action: '',
  });

  const tabs = [
    { title: 'Schemas' },
    { title: 'Data' },
    { title: 'Custom' },
    { title: 'Settings' },
  ];

  useEffect(() => {
    dispatch(getCmsSchemas());
    dispatch(getCustomEndpoints());
  }, [dispatch]);

  useEffect(() => {
    if (data.schemas.length > 0) {
      const name = data.schemas[0].name;
      dispatch(getSchemaDocuments(name));
    }
  }, [data.schemas, dispatch]);

  const handleSelectSchema = (name) => {
    dispatch(getSchemaDocuments(name));
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const snackbarAlert = () => {
    if (error) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          {error?.data?.error ? error.data.error : 'Something went wrong!'}
        </Alert>
      );
    } else {
      return undefined;
    }
  };

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  const handleDialogClose = () => {
    setOpen(false);
  };

  const handleCloseDisable = () => {
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const handleAdd = () => {
    setOpen(true);
  };

  const handleDeleteSchema = () => {
    dispatch(deleteSelectedSchema(selectedSchemaForAction.data._id));
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const handleToggleSchema = () => {
    dispatch(toggleSchema(selectedSchemaForAction.data._id));
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const getActiveSchemas = () => {
    if (!data || !data.schemas) {
      return [];
    }
    return data.schemas.filter((s) => s.enabled);
  };

  const getDisabledSchemas = () => {
    if (!data || !data.schemas) {
      return [];
    }
    return data.schemas.filter((s) => !s.enabled);
  };

  const enabledActions = [
    { title: 'Edit', type: 'edit' },
    { title: 'Disable', type: 'disable' },
  ];
  const disabledActions = [
    { title: 'Enable', type: 'enable' },
    { title: 'Delete', type: 'delete' },
  ];

  const handleActions = (action, data) => {
    switch (action.type) {
      case 'edit':
        dispatch(setSelectedSchema(data._id));
        router.push(
          { pathname: '/cms/build-types', query: { schemaId: data.id ? data.id : null } },
          '/cms/build-types'
        );
        break;
      case 'disable':
        setSelectedSchemaForAction({ data, action: 'disable' });
        setOpenDisable(true);
        break;
      case 'enable':
        setSelectedSchemaForAction({ data, action: 'enable' });
        setOpenDisable(true);
        break;
      case 'delete':
        setSelectedSchemaForAction({ data, action: 'delete' });
        setOpenDisable(true);
        break;
      default:
        break;
    }
  };

  const handleCreateCustomEndpoint = (data) => {
    if (data) {
      dispatch(createCustomEndpoints(data));
    }
  };
  const handleEditCustomEndpoint = (_id, data) => {
    dispatch(updateCustomEndpoints(_id, data));
  };
  const handleDeleteCustomEndpoint = (endpointId) => {
    if (endpointId) {
      dispatch(deleteCustomEndpoints(endpointId));
    }
  };

  return (
    <Layout itemSelected={4}>
      <Box p={2}>
        <Box
          display={'flex'}
          justifyContent={'space-between'}
          alignItems={'center'}
          mb={2}>
          <Typography variant={'h5'}>Content Management</Typography>
          {selected === 0 && (
            <Button
              variant="contained"
              color="primary"
              style={{ textTransform: 'capitalize' }}
              onClick={() => handleAdd()}>
              Create new
            </Button>
          )}
        </Box>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          {data && data.schemas && data.schemas.length > 0 && (
            <SchemasTable
              activeSchemas={getActiveSchemas()}
              disabledSchemas={getDisabledSchemas()}
              activeActions={enabledActions}
              disabledActions={disabledActions}
              handleActions={handleActions}
            />
          )}
          <Box className={classes.moreButton}>
            <Button
              color="primary"
              variant={'outlined'}
              disabled={data.schemas.length === data.count}
              onClick={() => dispatch(getMoreCmsSchemas())}>
              LOAD MORE SCHEMAS
            </Button>
          </Box>
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          {data && data.schemas && data.schemas.length > 0 && (
            <SchemaData
              schemas={getActiveSchemas()}
              schemaDocuments={data.documents}
              handleSchemaChange={handleSelectSchema}
            />
          )}
        </Box>
      </Box>
      <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
        <CustomQueries
          endpoints={data.customEndpoints}
          availableSchemas={data.schemas}
          handleCreate={handleCreateCustomEndpoint}
          handleEdit={handleEditCustomEndpoint}
          handleDelete={handleDeleteCustomEndpoint}
        />
      </Box>
      <Box role="tabpanel" hidden={selected !== 3} id={`tabpanel-3`}>
        {/*TODO SETTINGS*/}
      </Box>
      <NewSchemaDialog open={open} handleClose={handleDialogClose} />
      <DisableSchemaDialog
        open={openDisable}
        handleClose={handleCloseDisable}
        handleToggle={handleToggleSchema}
        handleDelete={handleDeleteSchema}
        selectedSchema={selectedSchemaForAction}
      />
      <Snackbar
        open={snackbarOpen}
        className={classes.snackBar}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbarAlert()}
      </Snackbar>
      <Backdrop open={loading} className={classes.backdrop}>
        <CircularProgress color="secondary" />
      </Backdrop>
    </Layout>
  );
};

export default privateRoute(Types);

import React, { SyntheticEvent, useEffect, useState } from 'react';
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
import Snackbar from '@material-ui/core/Snackbar';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import { ICmsSlice, setSelectedSchema } from '../../redux/slices/cmsSlice';
import CustomQueries from '../../components/cms/custom-endpoints/CustomQueries';
import {
  asyncCreateCustomEndpoints,
  asyncDeleteCustomEndpoints,
  asyncDeleteSelectedSchema,
  asyncGetCmsSchemas,
  asyncGetCustomEndpoints,
  asyncGetMoreCmsSchemas,
  asyncGetSchemaDocuments,
  asyncToggleSchema,
  asyncUpdateCustomEndpoints,
} from '../../redux/slices/cmsSlice';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { Schema } from '../../models/cms/CmsModels';

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
  const dispatch = useAppDispatch();
  const classes = useStyles();

  const data = useAppSelector((state) => state.cmsSlice.data);

  const { loading, error } = useAppSelector((state) => state.cmsSlice.meta);

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
    dispatch(asyncGetCmsSchemas(50));
    dispatch(asyncGetCustomEndpoints(''));
  }, [dispatch]);

  useEffect(() => {
    if (data.schemas?.length > 0) {
      const schemaFound = data.schemas.find((schema: Schema) => schema.enabled === true);
      if (schemaFound) {
        const { name } = schemaFound;
        dispatch(asyncGetSchemaDocuments(name));
      }
    }
  }, [data.schemas, dispatch]);

  const handleSelectSchema = (name: string) => {
    dispatch(asyncGetSchemaDocuments(name));
  };

  const handleClose = (event: any, reason: any) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const snackbarAlert = () => {
    if (error) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          {error ? error : 'Something went wrong!'}
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
    dispatch(asyncDeleteSelectedSchema(selectedSchemaForAction.data._id));
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const handleToggleSchema = () => {
    dispatch(asyncToggleSchema(selectedSchemaForAction.data._id));
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const getActiveSchemas = () => {
    if (!data || !data.schemas) {
      return [];
    }
    return data.schemas.filter((s: Schema) => s.enabled);
  };

  const getDisabledSchemas = () => {
    if (!data || !data.schemas) {
      return [];
    }
    return data.schemas.filter((s: Schema) => !s.enabled);
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
      dispatch(asyncCreateCustomEndpoints(data));
    }
  };

  const handleEditCustomEndpoint = (_id: string, data) => {
    dispatch(asyncUpdateCustomEndpoints({ _id, endpointData: data }));
  };

  const handleDeleteCustomEndpoint = (endpointId: string) => {
    if (endpointId) {
      dispatch(asyncDeleteCustomEndpoints(endpointId));
    }
  };

  return (
    <>
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
              onClick={() => dispatch(asyncGetMoreCmsSchemas({}))}>
              LOAD MORE SCHEMAS
            </Button>
          </Box>
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          {data && data.schemas && data.schemas.length > 0 && (
            <SchemaData
              schemas={getActiveSchemas()}
              handleSchemaChange={handleSelectSchema}
            />
          )}
        </Box>
      </Box>
      <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
        <CustomQueries
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
    </>
  );
};

export default privateRoute(Types);

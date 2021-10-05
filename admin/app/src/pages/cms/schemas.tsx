import React, { ReactElement, useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '../../redux/store';
import CmsLayout from '../../components/navigation/InnerLayouts/cmsLayout';
import {
  asyncDeleteSelectedSchema,
  asyncGetCmsSchemas,
  asyncGetMoreCmsSchemas,
  asyncToggleSchema,
  setSelectedSchema,
} from '../../redux/slices/cmsSlice';
import { Schema } from '../../models/cms/CmsModels';
import { useRouter } from 'next/router';
import SchemasTable from '../../components/cms/SchemasTable';
import NewSchemaDialog from '../../components/cms/NewSchemaDialog';
import DisableSchemaDialog from '../../components/cms/DisableSchemaDialog';
import { Box, Button, makeStyles } from '@material-ui/core';

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
  buttonAlignment: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginTop: '-25px',
  },
}));

const Schemas = () => {
  const classes = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [openDisable, setOpenDisable] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedSchemaForAction, setSelectedSchemaForAction] = useState<any>({
    data: {},
    action: '',
  });

  const data = useAppSelector((state) => state.cmsSlice.data);

  useEffect(() => {
    dispatch(asyncGetCmsSchemas(50));
  }, [dispatch]);

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

  const handleToggleSchema = () => {
    dispatch(asyncToggleSchema(selectedSchemaForAction.data._id));
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const handleDeleteSchema = () => {
    dispatch(asyncDeleteSelectedSchema(selectedSchemaForAction.data._id));
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const enabledActions = [
    { title: 'Edit', type: 'edit' },
    { title: 'Disable', type: 'disable' },
  ];
  const disabledActions = [
    { title: 'Enable', type: 'enable' },
    { title: 'Delete', type: 'delete' },
  ];

  const handleAdd = () => {
    setOpen(true);
  };

  const handleActions = (action: any, data: any) => {
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

  const handleCloseDisable = () => {
    setSelectedSchemaForAction({ data: {}, action: '' });
    setOpenDisable(false);
  };

  const handleDialogClose = () => {
    setOpen(false);
  };

  return (
    data &&
    data.schemas &&
    data.schemas.length > 0 && (
      <>
        <SchemasTable
          activeSchemas={getActiveSchemas()}
          disabledSchemas={getDisabledSchemas()}
          activeActions={enabledActions}
          disabledActions={disabledActions}
          handleActions={handleActions}
          handleAdd={() => handleAdd()}
        />
        <Box className={classes.moreButton}>
          <Button
            color="primary"
            variant={'outlined'}
            disabled={data.schemas.length === data.count}
            onClick={() => dispatch(asyncGetMoreCmsSchemas({}))}>
            LOAD MORE SCHEMAS
          </Button>
        </Box>
        <NewSchemaDialog open={open} handleClose={handleDialogClose} />
        <DisableSchemaDialog
          open={openDisable}
          handleClose={handleCloseDisable}
          handleToggle={handleToggleSchema}
          handleDelete={handleDeleteSchema}
          selectedSchema={selectedSchemaForAction}
        />
      </>
    )
  );
};

Schemas.getLayout = function getLayout(page: ReactElement) {
  return <CmsLayout>{page}</CmsLayout>;
};

export default Schemas;

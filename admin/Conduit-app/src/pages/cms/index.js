import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import CustomTabs from '../../components/CustomTabs';
import { privateRoute } from '../../components/utils/privateRoute';
import SchemasTable from '../../components/cms/SchemasTable';
import NewSchemaDialog from '../../components/cms/NewSchemaDialog';
import DisableSchemaDialog from '../../components/cms/DisableSchemaDialog';
import { useRouter } from 'next/router';

const Types = () => {
  const [openDisable, setOpenDisable] = useState(false);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const router = useRouter();

  const tabs = [{ title: 'Schemas' }, { title: 'Data' }, { title: 'Settings' }];

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleCloseDisable = () => {
    setSelectedSchema(null);
    setOpenDisable(false);
  };

  const handleAdd = () => {
    setOpen(true);
  };

  const handleDisable = () => {
    setSelectedSchema(null);
    setOpenDisable(false);
  };

  const dummyData = [{ name: 'User', apiId: '123321', types: 'Object', itemsCount: 23 }];
  const dummyDataDisable = [{ name: 'KKati', apiId: '123321', types: 'Object', itemsCount: 23 }];

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
        router.push({ pathname: '/cms/build-types', query: { schemaId: data.id ? data.id : null } }, '/cms/build-types');
        break;
      case 'disable':
        setSelectedSchema(data);
        setOpenDisable(true);
        break;
      case 'enable':
        break;
      case 'delete':
        break;
    }
  };

  return (
    <Layout itemSelected={4}>
      <Box p={2}>
        <Box display={'flex'} justifyContent={'space-between'} alignItems={'center'} mb={2}>
          <Typography variant={'h5'}>Content Management</Typography>
          <Button variant="contained" color="primary" style={{ textTransform: 'capitalize' }} onClick={() => handleAdd()}>
            Create new
          </Button>
        </Box>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          <SchemasTable
            activeSchemas={dummyData}
            disabledSchemas={dummyDataDisable}
            activeActions={enabledActions}
            disabledActions={disabledActions}
            handleActions={handleActions}
          />
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          {/*TODO DATA VIEW*/}
        </Box>
      </Box>
      <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
        {/*TODO SETTINGS*/}
      </Box>
      <NewSchemaDialog open={open} handleClose={handleClose} />
      <DisableSchemaDialog
        open={openDisable}
        handleClose={handleCloseDisable}
        handleDisable={handleDisable}
        selectedSchema={selectedSchema}
      />
    </Layout>
  );
};

export default privateRoute(Types);

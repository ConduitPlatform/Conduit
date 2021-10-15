import { Box, Button, Grid, makeStyles, Typography } from '@material-ui/core';
import { AddCircleOutline } from '@material-ui/icons';
import React, { ReactElement, useEffect, useState } from 'react';
import DataTable from '../../components/common/DataTable';
import Paginator from '../../components/common/Paginator';
import ViewEditForm from '../../components/forms/ViewEditForm';
import FormsLayout from '../../components/navigation/InnerLayouts/formsLayout';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import { FormsModel } from '../../models/forms/FormsModels';
import { asyncCreateForm, asyncEditForm, asyncGetForms } from '../../redux/slices/formsSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';

const useStyles = makeStyles((theme) => ({
  btnAlignment: {
    marginLeft: theme.spacing(1),
  },
  btnAlignment2: {
    marginRight: theme.spacing(1),
  },
  noAvailable: {
    textAlign: 'center',
    marginTop: '50px',
  },
}));

const Create = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const emptyFormState = {
    _id: '',
    name: '',
    fields: {},
    forwardTo: '',
    emailField: '',
    enabled: false,
  };
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [drawer, setDrawer] = useState<boolean>(false);
  const [formToView, setFormToView] = useState<FormsModel>(emptyFormState);
  const [selectedForms, setSelectedForms] = useState<any>([]);
  const [create, setCreate] = useState<boolean>(false);
  const [edit, setEdit] = useState<boolean>(false);

  const { forms, count } = useAppSelector((state) => state.formsSlice.data);

  useEffect(() => {
    dispatch(asyncGetForms());
  }, [dispatch]);

  const newForm = () => {
    setDrawer(true);
    setCreate(true);
    setEdit(true);
  };

  const handleCloseDrawer = () => {
    setDrawer(false);
    setCreate(false);
    setEdit(false);
    setFormToView(emptyFormState);
  };

  const saveFormChanges = (data: FormsModel) => {
    const _id = data._id;
    const updatedData = {
      _id: data._id,
      name: data.name,
      fields: data.fields,
      forwardTo: data.forwardTo,
      emailField: data.emailField,
      enabled: data.enabled,
    };
    if (_id !== undefined) {
      dispatch(asyncEditForm({ _id, data: updatedData }));
    }
    setFormToView(updatedData);
  };

  const createNewForm = (data: FormsModel) => {
    const newData = {
      name: data.name,
      fields: data.fields,
      forwardTo: data.forwardTo,
      emailField: data.emailField,
      enabled: data.enabled,
    };
    dispatch(asyncCreateForm(newData));
    setFormToView(newData);
  };

  const handlePageChange = (event: React.MouseEvent<HTMLButtonElement> | null, val: number) => {
    if (val > page) {
      setPage(page + 1);
      setSkip(skip + limit);
    } else {
      setPage(page - 1);
      setSkip(skip - limit);
    }
  };

  const handleSelect = (id: string) => {
    const newSelectedForms = [...selectedForms];

    if (selectedForms.includes(id)) {
      const index = newSelectedForms.findIndex((newId) => newId === id);
      newSelectedForms.splice(index, 1);
    } else {
      newSelectedForms.push(id);
    }
    setSelectedForms(newSelectedForms);
  };

  const handleSelectAll = (data: any) => {
    if (selectedForms.length === forms.length) {
      setSelectedForms([]);
      return;
    }
    const newSelectedForms = data.map((item: any) => item._id);
    setSelectedForms(newSelectedForms);
  };

  const handleLimitChange = (e: any) => {
    setLimit(e.target.value);
    setSkip(0);
    setPage(0);
  };

  const formatData = (data: FormsModel[]) => {
    return data.map((u) => {
      return {
        _id: u._id,
        Name: u.name,
        Email: u.emailField,
        Enabled: u.enabled,
      };
    });
  };

  const handleAction = (action: { title: string; type: string }, data: any) => {
    const currentForm = forms?.find((form) => form._id === data._id);
    if (currentForm !== undefined) {
      if (action.type === 'view') {
        setDrawer(true);
        setEdit(false);
        setFormToView(currentForm);
      }
      if (action.type === 'delete') {
        console.log('delete');
      }
    }
  };

  const toDelete = {
    title: 'Delete',
    type: 'delete',
  };

  const toView = {
    title: 'View',
    type: 'view',
  };

  const actions = [toDelete, toView];

  return (
    <div>
      <Grid container justify="flex-end">
        <Grid item>
          <Button
            style={{ marginBottom: '5px' }}
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutline />}
            onClick={() => newForm()}>
            Add new form
          </Button>
        </Grid>
      </Grid>
      {count > 0 ? (
        <Box>
          <DataTable
            dsData={formatData(forms)}
            actions={actions}
            handleAction={handleAction}
            handleSelect={handleSelect}
            handleSelectAll={handleSelectAll}
            selectedItems={selectedForms}
          />

          <Grid container style={{ marginTop: '-8px' }}>
            <Grid item xs={7}></Grid>
            <Grid item xs={5}>
              <Paginator
                handlePageChange={handlePageChange}
                limit={limit}
                handleLimitChange={handleLimitChange}
                page={page}
                count={count}
              />
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Typography className={classes.noAvailable}>No available forms </Typography>
      )}
      <DrawerWrapper open={drawer} closeDrawer={() => handleCloseDrawer()} width={700}>
        <Typography variant="h6" color="primary" style={{ marginTop: '30px', textAlign: 'center' }}>
          {create ? 'Create a new form' : 'Edit form'}
        </Typography>
        <ViewEditForm
          handleCreate={createNewForm}
          handleSave={saveFormChanges}
          form={formToView}
          edit={edit}
          create={create}
          setEdit={setEdit}
          setCreate={setCreate}
        />
      </DrawerWrapper>
    </div>
  );
};

Create.getLayout = function getLayout(page: ReactElement) {
  return <FormsLayout>{page}</FormsLayout>;
};

export default Create;

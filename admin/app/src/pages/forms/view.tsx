import {
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  makeStyles,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import { AddCircleOutline, DeleteTwoTone } from '@material-ui/icons';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import DataTable from '../../components/common/DataTable';
import Paginator from '../../components/common/Paginator';
import FormReplies from '../../components/forms/FormReplies';
import ViewEditForm from '../../components/forms/ViewEditForm';
import FormsLayout from '../../components/navigation/InnerLayouts/formsLayout';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import useDebounce from '../../hooks/useDebounce';
import { FormsModel, FormsUI } from '../../models/forms/FormsModels';
import {
  asyncCreateForm,
  asyncDeleteForms,
  asyncEditForm,
  asyncGetForms,
} from '../../redux/slices/formsSlice';
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
  const [openDeleteForms, setOpenDeleteForms] = useState<{
    open: boolean;
    multiple: boolean;
  }>({
    open: false,
    multiple: false,
  });
  const [selectedForm, setSelectedForm] = useState<FormsModel>(emptyFormState);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [drawer, setDrawer] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [create, setCreate] = useState<boolean>(false);
  const [edit, setEdit] = useState<boolean>(false);
  const [repliesForm, setRepliesForm] = useState<FormsModel>(emptyFormState);

  const debouncedSearch: string = useDebounce(search, 500);

  const { forms, count } = useAppSelector((state) => state.formsSlice.data);

  useEffect(() => {
    dispatch(asyncGetForms({ skip, limit, search: debouncedSearch }));
  }, [dispatch, skip, limit, debouncedSearch]);

  const getFormsCallback = useCallback(() => {
    dispatch(asyncGetForms({ skip, limit, search: debouncedSearch }));
  }, [dispatch, limit, skip, debouncedSearch]);

  const newForm = () => {
    setDrawer(true);
    setCreate(true);
    setEdit(true);
  };

  const handleCloseDrawer = () => {
    setDrawer(false);
    setCreate(false);
    setEdit(false);
    setRepliesForm(emptyFormState);

    setSelectedForm(emptyFormState);
    setOpenDeleteForms({
      open: false,
      multiple: false,
    });
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
    setSelectedForm(updatedData);
  };

  const createNewForm = (data: FormsModel) => {
    setDrawer(false);
    const newData = {
      name: data.name,
      fields: data.fields,
      forwardTo: data.forwardTo,
      emailField: data.emailField,
      enabled: data.enabled,
    };
    dispatch(asyncCreateForm(newData));
    setSelectedForm(newData);
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

  const handleSelectAll = (data: FormsUI[]) => {
    if (selectedForms.length === forms.length) {
      setSelectedForms([]);
      return;
    }
    const newSelectedForms = data.map((item: FormsUI) => item._id);
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
        setSelectedForm(currentForm);
      }
      if (action.type === 'replies') {
        setRepliesForm(currentForm);
        setDrawer(true);
      }
      if (action.type === 'delete') {
        setSelectedForm(currentForm);
        setOpenDeleteForms({
          open: true,
          multiple: false,
        });
      }
    }
  };

  const deleteButtonAction = () => {
    if (openDeleteForms.open && openDeleteForms.multiple) {
      const params = {
        ids: selectedForms,
        getForms: getFormsCallback,
      };
      dispatch(asyncDeleteForms(params));
    } else {
      const params = {
        ids: [`${selectedForm._id}`],
        getForms: getFormsCallback,
      };
      dispatch(asyncDeleteForms(params));
    }
    setOpenDeleteForms({
      open: false,
      multiple: false,
    });
  };

  const toDelete = {
    title: 'Delete',
    type: 'delete',
  };

  const toReplies = {
    title: 'Form replies',
    type: 'replies',
  };

  const toView = {
    title: 'View',
    type: 'view',
  };

  const actions = [toDelete, toReplies, toView];

  const handleDeleteTitle = (multiple: boolean, form: FormsModel) => {
    if (multiple) {
      return 'Delete selected forms';
    }
    return `Delete form ${form.name}`;
  };

  const handleDeleteDescription = (multiple: boolean, form: FormsModel) => {
    if (multiple) {
      return 'Are you sure you want to delete the selected forms?';
    }
    return `Are you sure you want to delete ${form.name}? `;
  };

  return (
    <div>
      <Grid container justify="space-between" style={{ marginBottom: '5px' }}>
        <Grid item>
          <TextField
            size="small"
            variant="outlined"
            name="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            label="Find template"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item>
          {selectedForms.length > 1 && (
            <IconButton
              aria-label="delete"
              color="primary"
              onClick={() =>
                setOpenDeleteForms({
                  open: true,
                  multiple: true,
                })
              }>
              <Tooltip title="Delete multiple forms">
                <DeleteTwoTone />
              </Tooltip>
            </IconButton>
          )}

          <Button
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
        {repliesForm.name === '' ? (
          <>
            <Typography
              variant="h6"
              color="primary"
              style={{ marginTop: '30px', textAlign: 'center' }}>
              {create ? 'Create a new form' : 'Edit form'}
            </Typography>
            <ViewEditForm
              handleCreate={createNewForm}
              handleSave={saveFormChanges}
              form={selectedForm}
              edit={edit}
              create={create}
              setEdit={setEdit}
              setCreate={setCreate}
            />
          </>
        ) : (
          <>
            <Typography
              variant="h6"
              color="primary"
              style={{ marginTop: '30px', textAlign: 'center' }}>
              Viewing form replies from {repliesForm.name}
            </Typography>
            <FormReplies repliesForm={repliesForm} />
          </>
        )}
      </DrawerWrapper>
      <ConfirmationDialog
        open={openDeleteForms.open}
        handleClose={handleCloseDrawer}
        title={handleDeleteTitle(openDeleteForms.multiple, selectedForm)}
        description={handleDeleteDescription(openDeleteForms.multiple, selectedForm)}
        buttonAction={deleteButtonAction}
        buttonText={'Delete'}
      />
    </div>
  );
};

Create.getLayout = function getLayout(page: ReactElement) {
  return <FormsLayout>{page}</FormsLayout>;
};

export default Create;

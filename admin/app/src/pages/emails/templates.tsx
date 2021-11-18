import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import EmailsLayout from '../../components/navigation/InnerLayouts/emailsLayout';
import {
  asyncCreateNewEmailTemplate,
  asyncDeleteTemplates,
  asyncGetEmailTemplates,
  asyncSaveEmailTemplateChanges,
  asyncSyncTemplates,
  asyncUploadTemplate,
} from '../../redux/slices/emailsSlice';
import DataTable from '../../components/common/DataTable';
import { EmailTemplateType, EmailUI } from '../../models/emails/EmailModels';
import {
  Box,
  Button,
  Grid,
  Typography,
  TextField,
  IconButton,
  makeStyles,
  InputAdornment,
  Tooltip,
} from '@material-ui/core';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import TabPanel from '../../components/emails/TabPanel';
import { CallMissedOutgoing } from '@material-ui/icons';
import Sync from '@material-ui/icons/Sync';
import SearchIcon from '@material-ui/icons/Search';
import Paginator from '../../components/common/Paginator';
import ExternalTemplates from '../../components/emails/ExternalTemplates';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { DeleteTwoTone } from '@material-ui/icons';
import useDebounce from '../../hooks/useDebounce';
import { enqueueInfoNotification } from '../../utils/useNotifier';

const useStyles = makeStyles((theme) => ({
  btnAlignment: {
    marginLeft: theme.spacing(1.5),
  },
  btnAlignment2: {
    marginRight: theme.spacing(1.5),
  },
  actions: {},
}));

const Templates = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const originalTemplateState = {
    _id: '',
    name: '',
    subject: '',
    body: '',
    variables: [],
    sender: '',
    externalManaged: false,
  };
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<{ asc: boolean; index: string | null }>({
    asc: false,
    index: null,
  });
  const [openDeleteTemplates, setOpenDeleteTemplates] = useState<boolean>(false);
  const [drawer, setDrawer] = useState<boolean>(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplateType>(originalTemplateState);
  const [importTemplate, setImportTemplate] = useState<boolean>(false);
  const [create, setCreate] = useState<boolean>(false);
  const [edit, setEdit] = useState<boolean>(false);

  const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    dispatch(asyncGetEmailTemplates({ skip, limit, search: debouncedSearch }));
  }, [dispatch, limit, skip, debouncedSearch]);

  useEffect(() => {
    setSkip(0);
    setPage(0);
    setLimit(10);
  }, [debouncedSearch]);

  const { templateDocuments, totalCount } = useAppSelector((state) => state.emailsSlice.data);

  const newTemplate = () => {
    setImportTemplate(false);
    setSelectedTemplate(originalTemplateState);
    setCreate(true);
    setEdit(true);
    setDrawer(true);
  };

  const handleImportTemplate = () => {
    setImportTemplate(true);
    setDrawer(true);
  };

  const saveTemplateChanges = (data: EmailTemplateType) => {
    const _id = data._id;
    const updatedData = {
      name: data.name,
      subject: data.subject,
      sender: data.sender !== '' ? data.sender : undefined,
      body: data.body,
      variables: data.variables,
      externalManaged: data.externalManaged,
    };
    if (_id !== undefined) {
      dispatch(asyncSaveEmailTemplateChanges({ _id, data: updatedData }));
    }
    setSelectedTemplate(updatedData);
  };

  const createNewTemplate = (data: EmailTemplateType) => {
    const newData = {
      name: data.name,
      subject: data.subject,
      sender: data.sender,
      body: data.body,
      externalManaged: data.externalManaged,
      variables: data.variables,
      _id: data._id,
    };
    dispatch(asyncCreateNewEmailTemplate(newData));
    setSelectedTemplate(newData);
    setDrawer(false);
  };

  const handleClose = () => {
    setImportTemplate(false);
    setEdit(false);
    setCreate(false);
    setDrawer(false);
    setSelectedTemplate(originalTemplateState);
    setSelectedTemplate(originalTemplateState);
    setOpenDeleteTemplates(false);
  };

  const handleSelect = (id: string) => {
    const newSelectedTemplates = [...selectedTemplates];

    if (selectedTemplates.includes(id)) {
      const index = newSelectedTemplates.findIndex((newId) => newId === id);
      newSelectedTemplates.splice(index, 1);
    } else {
      newSelectedTemplates.push(id);
    }
    setSelectedTemplates(newSelectedTemplates);
  };

  const handleSelectAll = (data: EmailUI[]) => {
    if (selectedTemplates.length === templateDocuments.length) {
      setSelectedTemplates([]);
      return;
    }
    const newSelectedTemplates = data.map((item: EmailUI) => item._id);
    setSelectedTemplates(newSelectedTemplates);
  };

  const getTemplatesCallback = useCallback(() => {
    dispatch(asyncGetEmailTemplates({ skip, limit, search }));
  }, [dispatch, limit, skip, search]);

  const handlePageChange = (event: React.MouseEvent<HTMLButtonElement> | null, val: number) => {
    if (val > page) {
      setPage(page + 1);
      setSkip(skip + limit);
    } else {
      setPage(page - 1);
      setSkip(skip - limit);
    }
  };

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setSkip(0);
    setPage(0);
  };

  const handleAction = (action: { title: string; type: string }, data: EmailUI) => {
    const currentTemplate = templateDocuments?.find((template) => template._id === data._id);

    if (currentTemplate !== undefined) {
      if (action.type === 'view') {
        setSelectedTemplate(currentTemplate);
        setEdit(false);
        setDrawer(true);
      }
      if (action.type === 'delete') {
        setSelectedTemplate(currentTemplate);
        setOpenDeleteTemplates(true);
      }
      if (action.type === 'upload') {
        if (currentTemplate.externalManaged) {
          dispatch(enqueueInfoNotification('The selected template is already uploaded'));
          return;
        }

        if (currentTemplate._id !== undefined) {
          dispatch(asyncUploadTemplate(currentTemplate._id));
        }
      }
    }
  };

  const handleDeleteTitle = (template: EmailTemplateType) => {
    if (selectedTemplate.name === '') {
      return 'Delete selected templates';
    }
    return `Delete template ${template.name}`;
  };

  const handleDeleteDescription = (template: EmailTemplateType) => {
    if (selectedTemplate.name === '') {
      return 'Are you sure you want to delete the selected templates?';
    }
    return `Are you sure you want to delete ${template.name}? `;
  };

  const deleteButtonAction = () => {
    if (openDeleteTemplates && selectedTemplate.name == '') {
      const params = {
        ids: selectedTemplates,
        getTemplates: getTemplatesCallback,
      };
      dispatch(asyncDeleteTemplates(params));
    } else {
      const params = {
        ids: [`${selectedTemplate._id}`],
        getTemplates: getTemplatesCallback,
      };
      dispatch(asyncDeleteTemplates(params));
    }
    setOpenDeleteTemplates(false);
    setSelectedTemplate(originalTemplateState);
    setSelectedTemplates([]);
  };

  const toDelete = {
    title: 'Delete',
    type: 'delete',
  };

  const toUpload = {
    title: 'Upload',
    type: 'upload',
  };

  const toView = {
    title: 'View',
    type: 'view',
  };

  const actions = [toDelete, toUpload, toView];

  const formatData = (data: EmailTemplateType[]) => {
    return data.map((u) => {
      return {
        _id: u._id,
        Name: u.name,
        External: u.externalManaged,
        'Updated At': u.updatedAt,
      };
    });
  };

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Name', sort: 'name' },
    { title: 'External', sort: 'externalManaged' },
    { title: 'Updated At', sort: 'updatedAt' },
  ];

  return (
    <div>
      <Grid container item xs={12} justify="space-between" className={classes.actions}>
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
          {selectedTemplates.length > 0 && (
            <IconButton
              aria-label="delete"
              color="primary"
              onClick={() => setOpenDeleteTemplates(true)}>
              <Tooltip title="Delete multiple templates">
                <DeleteTwoTone />
              </Tooltip>
            </IconButton>
          )}
          <IconButton
            color="primary"
            className={classes.btnAlignment}
            onClick={() => dispatch(asyncSyncTemplates())}>
            <Tooltip title="Sync external templates">
              <Sync color="primary" />
            </Tooltip>
          </IconButton>
          <Button
            className={classes.btnAlignment2}
            variant="contained"
            color="secondary"
            onClick={() => handleImportTemplate()}
            startIcon={<CallMissedOutgoing />}>
            Import Template
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutline />}
            onClick={() => newTemplate()}>
            New Template
          </Button>
        </Grid>
      </Grid>
      {templateDocuments.length > 0 ? (
        <>
          <DataTable
            sort={sort}
            setSort={setSort}
            headers={headers}
            dsData={formatData(templateDocuments)}
            actions={actions}
            handleAction={handleAction}
            handleSelect={handleSelect}
            handleSelectAll={handleSelectAll}
            selectedItems={selectedTemplates}
          />
          <Grid container style={{ marginTop: '-8px' }}>
            <Grid item xs={7} />
            <Grid item xs={5}>
              <Paginator
                handlePageChange={handlePageChange}
                limit={limit}
                handleLimitChange={handleLimitChange}
                page={page}
                count={totalCount}
              />
            </Grid>
          </Grid>
        </>
      ) : (
        <Typography>No available templates</Typography>
      )}
      <DrawerWrapper open={drawer} closeDrawer={() => handleClose()} width={750}>
        {!importTemplate ? (
          <Box>
            <Typography variant="h6" style={{ marginTop: '30px', textAlign: 'center' }}>
              {!create ? 'Edit your template' : 'Create an email template'}
            </Typography>
            <TabPanel
              handleCreate={createNewTemplate}
              handleSave={saveTemplateChanges}
              template={selectedTemplate}
              edit={edit}
              setEdit={setEdit}
              create={create}
              setCreate={setCreate}
            />
          </Box>
        ) : (
          <Box>
            <Typography
              variant="h6"
              color="primary"
              style={{ marginTop: '30px', textAlign: 'center' }}>
              Import an external template
            </Typography>
            <ExternalTemplates handleSave={createNewTemplate} />
          </Box>
        )}
      </DrawerWrapper>
      <ConfirmationDialog
        open={openDeleteTemplates}
        handleClose={handleClose}
        title={handleDeleteTitle(selectedTemplate)}
        description={handleDeleteDescription(selectedTemplate)}
        buttonAction={deleteButtonAction}
        buttonText={'Delete'}
      />
    </div>
  );
};

Templates.getLayout = function getLayout(page: ReactElement) {
  return <EmailsLayout>{page}</EmailsLayout>;
};

export default Templates;

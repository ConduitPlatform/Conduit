import React, { ReactElement, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import EmailsLayout from '../../components/navigation/InnerLayouts/emailsLayout';
import {
  asyncCreateNewEmailTemplate,
  asyncGetEmailTemplates,
  asyncSaveEmailTemplateChanges,
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
} from '@material-ui/core';
import DrawerWrapper from '../../components/navigation/SideDrawerWrapper';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import TabPanel from '../../components/emails/TabPanel';
import { CallMissedOutgoing } from '@material-ui/icons';
import Sync from '@material-ui/icons/Sync';
import SearchIcon from '@material-ui/icons/Search';
import Paginator from '../../components/common/Paginator';
import ExternalTemplates from '../../components/emails/ExternalTemplates';
// import useDebounce from '../../hooks/useDebounce';

const useStyles = makeStyles((theme) => ({
  btnAlignment: {
    marginLeft: theme.spacing(1),
  },
  btnAlignment2: {
    marginRight: theme.spacing(1),
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
  const [drawer, setDrawer] = useState<boolean>(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [viewTemplate, setViewTemplate] = useState<EmailTemplateType>(originalTemplateState);
  const [importTemplate, setImportTemplate] = useState<boolean>(false);
  const [create, setCreate] = useState<boolean>(false);
  const [edit, setEdit] = useState<boolean>(false);

  // const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    dispatch(asyncGetEmailTemplates({ skip, limit }));
  }, [dispatch, limit, skip]);

  const { templateDocuments, totalCount } = useAppSelector((state) => state.emailsSlice.data);

  const newTemplate = () => {
    setViewTemplate(originalTemplateState);
    setCreate(true);
    setEdit(true);
    setDrawer(true);
  };

  const handleImportTemplate = () => {
    setImportTemplate(true);
    setDrawer(true);
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

  const handleCloseDrawer = () => {
    setEdit(false);
    setCreate(false);
    setDrawer(false);
    setImportTemplate(false);
    setViewTemplate(originalTemplateState);
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
    setViewTemplate(updatedData);
  };

  const createNewTemplate = (data: EmailTemplateType) => {
    const newData = {
      name: data.name,
      subject: data.subject,
      sender: data.sender,
      body: data.body,
      externalManaged: data.externalManaged,
      variables: data.variables,
    };
    dispatch(asyncCreateNewEmailTemplate(newData));
    setViewTemplate(newData);
  };

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

  const handlePageChange = (event: React.MouseEvent<HTMLButtonElement> | null, val: number) => {
    if (val > page) {
      setPage(page + 1);
      setSkip(skip + limit);
    } else {
      setPage(page - 1);
      setSkip(skip - limit);
    }
  };

  const handleLimitChange = (e: any) => {
    setLimit(e.target.value);
    setSkip(0);
    setPage(0);
  };

  //Actions section

  const handleAction = (action: { title: string; type: string }, data: EmailUI) => {
    const currentTemplate = templateDocuments?.find((template) => template._id === data._id);
    if (currentTemplate !== undefined) {
      if (action.type === 'view') {
        setViewTemplate(currentTemplate);
        setEdit(false);
        setDrawer(true);
      }
      if (action.type === 'delete') {
        //handle delete
      }
      if (action.type === 'sync') {
        //handle sync
      }
      if (action.type === 'upload') {
        //handle upload
      }
    }
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
          <IconButton color="primary" className={classes.btnAlignment}>
            <Sync color="primary" />
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
      {templateDocuments.length > 0 && (
        <DataTable
          dsData={formatData(templateDocuments)}
          actions={actions}
          handleAction={handleAction}
          handleSelect={handleSelect}
          handleSelectAll={handleSelectAll}
          selectedItems={selectedTemplates}
        />
      )}
      {templateDocuments.length > 0 && (
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
      )}
      <DrawerWrapper open={drawer} closeDrawer={() => handleCloseDrawer()} width={700}>
        {!importTemplate ? (
          <Box>
            <Typography variant="h6" style={{ marginTop: '30px', textAlign: 'center' }}>
              {!create ? 'Edit your template' : 'Create an email template'}
            </Typography>
            <TabPanel
              handleCreate={createNewTemplate}
              handleSave={saveTemplateChanges}
              template={viewTemplate}
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
    </div>
  );
};

Templates.getLayout = function getLayout(page: ReactElement) {
  return <EmailsLayout>{page}</EmailsLayout>;
};

export default Templates;

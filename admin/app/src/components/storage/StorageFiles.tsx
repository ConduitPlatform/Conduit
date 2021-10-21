import { Button, Grid, InputAdornment, TextField } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { EmailTemplateType, EmailUI } from '../../models/emails/EmailModels';
import { asyncGetEmailTemplates } from '../../redux/slices/emailsSlice';
import SearchIcon from '@material-ui/icons/Search';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import DataTable from '../common/DataTable';
import Paginator from '../common/Paginator';
import StorageCreateDrawer from './StorageCreateDrawer';

const useStyles = makeStyles((theme) => ({}));

const StorageFiles = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [create, setCreate] = useState<boolean>(false);

  useEffect(() => {
    dispatch(asyncGetEmailTemplates({ skip, limit }));
  }, [dispatch, limit, skip]);

  const { templateDocuments, totalCount } = useAppSelector((state) => state.emailsSlice.data);

  const handleCreate = () => {
    setDrawerOpen(true);
    setCreate(true);
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
    setCreate(false);
    setDrawerOpen(false);
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

  const handleLimitChange = (value: number) => {
    setLimit(value);
    setSkip(0);
    setPage(0);
  };

  const handleAction = (action: { title: string; type: string }, data: EmailUI) => {
    const currentTemplate = templateDocuments?.find((template) => template._id === data._id);
    if (currentTemplate !== undefined) {
      if (action.type === 'delete') {
        //handle delete
      }
    }
  };

  const deleteAction = {
    title: 'Delete',
    type: 'delete',
  };

  const actions = [deleteAction];

  return (
    <div>
      <Grid container item xs={12} justify="space-between">
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
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutline />}
            onClick={() => handleCreate()}>
            Create
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
      <StorageCreateDrawer open={drawerOpen} closeDrawer={handleCloseDrawer} />
    </div>
  );
};

export default StorageFiles;

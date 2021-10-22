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
import StorageAddDrawer from './StorageAddDrawer';
import {
  asyncAddStorageContainer,
  asyncAddStorageFile,
  asyncAddStorageFolder,
  asyncDeleteStorageFile,
  asyncGetStorageContainers,
  asyncGetStorageFile,
  asyncGetStorageFiles,
  asyncGetStorageFolders,
  asyncUpdateStorageFile,
} from '../../redux/slices/storageSlice';

const useStyles = makeStyles((theme) => ({
  topContainer: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  createButton: {
    marginRight: theme.spacing(1),
  },
}));

const StorageFiles = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [page, setPage] = useState<number>(0);
  const [drawerCreateOpen, setDrawerCreateOpen] = useState<boolean>(false);
  const [drawerAddOpen, setDrawerAddOpen] = useState<boolean>(false);

  useEffect(() => {
    dispatch(asyncGetStorageContainers({ skip, limit }));
  }, [dispatch, limit, skip]);

  const {
    containers: { containers, containersCount },
  } = useAppSelector((state) => state.storageSlice.data);
  console.log('containers', containers);

  const handleCreate = () => {
    setDrawerCreateOpen(true);
  };

  const handleAddFile = () => {
    setDrawerAddOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerAddOpen(false);
    setDrawerCreateOpen(false);
  };

  const formatData = () => {
    return containers.map((container) => {
      return {
        Name: container.name,
        isPublic: container.isPublic,
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
    // const currentTemplate = templateDocuments?.find((template) => template._id === data._id);
    // if (currentTemplate !== undefined) {
    //   if (action.type === 'delete') {
    //     //handle delete
    //   }
    // }
  };

  const deleteAction = {
    title: 'Delete',
    type: 'delete',
  };

  const actions = [deleteAction];

  return (
    <div>
      <Grid container item xs={12} className={classes.topContainer}>
        <Grid item />
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            className={classes.createButton}
            startIcon={<AddCircleOutline />}
            onClick={() => handleCreate()}>
            Create
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddCircleOutline />}
            onClick={() => handleAddFile()}>
            {/*onClick={() => dispatch(asyncGetStorageFiles())}>*/}
            Add
          </Button>
        </Grid>
      </Grid>
      {containers.length > 0 && (
        <DataTable
          dsData={formatData()}
          actions={actions}
          handleAction={handleAction}
          selectable={false}
        />
      )}
      {/*{templateDocuments.length > 0 && (*/}
      {/*  <Grid container style={{ marginTop: '-8px' }}>*/}
      {/*    <Grid item xs={7} />*/}
      {/*    <Grid item xs={5}>*/}
      {/*      <Paginator*/}
      {/*        handlePageChange={handlePageChange}*/}
      {/*        limit={limit}*/}
      {/*        handleLimitChange={handleLimitChange}*/}
      {/*        page={page}*/}
      {/*        count={totalCount}*/}
      {/*      />*/}
      {/*    </Grid>*/}
      {/*  </Grid>*/}
      {/*)}*/}
      <StorageCreateDrawer open={drawerCreateOpen} closeDrawer={handleCloseDrawer} />
      <StorageAddDrawer open={drawerAddOpen} closeDrawer={handleCloseDrawer} />
    </div>
  );
};

export default StorageFiles;

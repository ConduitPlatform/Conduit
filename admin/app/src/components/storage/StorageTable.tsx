import { Button, Grid, InputAdornment, TextField } from '@material-ui/core';
import React, { FC, useEffect, useState } from 'react';
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
import { IContainer } from '../../models/storage/StorageModels';

const useStyles = makeStyles((theme) => ({
  topContainer: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  createButton: {
    marginRight: theme.spacing(1),
  },
}));

interface Props {
  data: any;
}

const StorageTable: FC<Props> = ({ data }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [drawerCreateOpen, setDrawerCreateOpen] = useState<boolean>(false);
  const [drawerAddOpen, setDrawerAddOpen] = useState<boolean>(false);

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
    return data.map((container: any) => {
      return {
        Name: container.name,
        isPublic: container.isPublic,
      };
    });
  };

  const handleAction = (action: { title: string; type: string }, data: EmailUI) => {
    // const currentTemplate = templateDocuments?.find((template) => template._id === data._id);
    // if (currentTemplate !== undefined) {
    //   if (action.type === 'delete') {
    //     //handle delete
    //   }
    // }
  };

  const handleRowClick = (value: { Name: string; isPublic: boolean }) => {
    const foundContainer = data.find((container: any) => container.name === value.Name);
    console.log('foundContainer', foundContainer);
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
      {data.length > 0 && (
        <DataTable
          dsData={formatData()}
          actions={actions}
          handleAction={handleAction}
          selectable={false}
          handleRowClick={(value) => handleRowClick(value)}
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

export default StorageTable;

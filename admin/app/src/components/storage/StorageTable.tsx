import { Button, Grid, Typography } from '@material-ui/core';
import React, { FC } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch } from '../../redux/store';
import { EmailUI } from '../../models/emails/EmailModels';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import DataTable from '../common/DataTable';
import {
  asyncGetStorageContainerData,
  asyncGetStorageFiles,
  asyncGetStorageFolders,
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

interface Props {
  data: any;
  path: string;
  handleAdd: any;
  handleCreate: any;
}

const StorageTable: FC<Props> = ({ data, path, handleAdd, handleCreate }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

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

  const handleGetSomeData = () => {
    dispatch(asyncGetStorageContainerData());
  };

  return (
    <>
      <Grid container item xs={12} className={classes.topContainer}>
        <Grid item>
          <Typography variant="subtitle1">{path}</Typography>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="secondary"
            className={classes.createButton}
            onClick={() => handleGetSomeData()}>
            {/*onClick={() => dispatch(asyncGetStorageFiles())}>*/}
            Get Data
          </Button>
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
            onClick={() => handleAdd()}>
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
    </>
  );
};

export default StorageTable;

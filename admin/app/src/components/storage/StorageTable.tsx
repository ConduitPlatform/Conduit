import { Button, Grid, Typography } from '@material-ui/core';
import React, { FC } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { EmailUI } from '../../models/emails/EmailModels';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import DataTable from '../common/DataTable';
import FolderIcon from '@material-ui/icons/Folder';

const useStyles = makeStyles((theme) => ({
  topContainer: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  createButton: {
    marginRight: theme.spacing(1),
  },
  pathContainer: {
    display: 'flex',
  },
  pathItem: {
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

interface Props {
  data: any;
  path: string;
  handleAdd: any;
  handleCreate: any;
  handlePathClick: (value: string) => void;
}

const StorageTable: FC<Props> = ({ data, path, handleAdd, handleCreate, handlePathClick }) => {
  const classes = useStyles();

  const formatData = () => {
    return data.map((container: any) => {
      return {
        icon: <FolderIcon />,
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

  const deleteAction = {
    title: 'Delete',
    type: 'delete',
  };

  const actions = [deleteAction];

  const headers = [{ title: '' }, { title: 'Name' }, { title: 'is Public' }];

  const onPathClick = (item: string, index: number) => {
    if (index === 0) {
      handlePathClick('/');
      return;
    }
    handlePathClick(`${path}/${item}`);
  }; //combine these two

  const onRowClick = (value: { Name: string; isPublic: boolean }) => {
    if (path.split('/')[1]) {
      handlePathClick(`${path}/${value.Name}`);
      return;
    }
    handlePathClick(`${path}${value.Name}`);
  };

  return (
    <>
      <Grid container item xs={12} className={classes.topContainer}>
        <Grid item className={classes.pathContainer}>
          {path.split('/').map((item, index) => {
            return (
              <Typography
                variant="subtitle1"
                className={classes.pathItem}
                onClick={() => onPathClick(item, index)}
                key={index}>
                {index === 0 ? '..' : `/${item}`}
              </Typography>
            );
          })}
        </Grid>
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
          handleRowClick={(value) => onRowClick(value)}
          headers={headers}
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

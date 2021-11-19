import React, { FC } from 'react';
import { Button, Grid, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import DataTable from '../common/DataTable';
import FolderIcon from '@material-ui/icons/Folder';
import DescriptionIcon from '@material-ui/icons/Description';
import FolderOpenIcon from '@material-ui/icons/FolderOpen';
import Paginator from '../common/Paginator';
import { ContainerDataProps, IStorageContainerData } from '../../models/storage/StorageModels';
import { asyncSetSelectedStorageFile } from '../../redux/slices/storageSlice';
import { useAppDispatch } from '../../redux/store';

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
  tableRow: {
    cursor: 'pointer',
  },
}));

interface IContainerTable {
  icon: JSX.Element;
  Name: string;
  isPublic: boolean;
}

interface IContainerDataTable {
  icon: JSX.Element;
  Name: string;
  isPublic: boolean;
  mimeType: string;
}

type FormData = IContainerTable | IContainerDataTable;

interface Props {
  containers: IStorageContainerData[];
  containerData: ContainerDataProps[];
  path: string;
  handleAdd: () => void;
  handleCreateContainer: () => void;
  handleCreateFolder: () => void;
  // handleEdit: (value: boolean) => void;
  handlePathClick: (value: string) => void;
  handleDelete: (
    type: 'container' | 'folder' | 'file',
    id: string,
    name: string,
    container?: string
  ) => void;
  handlePageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  handleLimitChange: (value: number) => void;
  limit: number;
  page: number;
  count: number;
  placeholder?: string;
}

const StorageTable: FC<Props> = ({
  containers,
  containerData,
  path,
  handleAdd,
  handleCreateContainer,
  handleCreateFolder,
  handlePathClick,
  handleDelete,
  handlePageChange,
  handleLimitChange,
  limit,
  page,
  count,
  placeholder,
}) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const formatData = () => {
    if (path === '/')
      return containers.map((item: IStorageContainerData) => {
        return {
          icon: <FolderOpenIcon />,
          Name: item.name,
          isPublic: item.isPublic,
        };
      });
    return containerData.map((item: ContainerDataProps) => {
      if ('isFile' in item && item.isFile) {
        return {
          icon: <DescriptionIcon />,
          Name: item.name,
          isPublic: item.isPublic,
          mimeType: 'mimeType' in item ? item.mimeType : undefined,
        };
      }
      const folderNameSplit = item.name.split('/');
      const folderName = folderNameSplit[folderNameSplit.length - 2];
      return {
        icon: <FolderIcon />,
        Name: folderName,
        isPublic: item.isPublic,
        mimeType: undefined,
      };
    });
  };

  const handleAction = (action: { title: string; type: string }, data: FormData) => {
    if (path === '/') {
      const container = containers.find((item: IStorageContainerData) => item.name === data.Name);
      if (!container) return;
      handleDelete('container', container._id, container.name);
      return;
    }
    const foundItem = containerData.find((item: ContainerDataProps) => item.name === data.Name);
    if (!foundItem) return;
    if ('isFile' in foundItem && foundItem.isFile) {
      handleDelete('file', foundItem._id, foundItem.name);
      return;
    }
    handleDelete('folder', foundItem._id, foundItem.name, foundItem.container);
  };

  const deleteAction = {
    title: 'Delete',
    type: 'delete',
  };

  const actions = [deleteAction];

  const containerHeaders = [{ title: '' }, { title: 'Name' }, { title: 'is Public' }];
  const headers = [{ title: '' }, { title: 'Name' }, { title: 'is Public' }, { title: 'mimeType' }];

  const onPathClick = (item: string, index?: number) => {
    const file = containerData.find((itemFile: ContainerDataProps) => {
      return itemFile.name === item;
    });
    if (containerData.length > 0 && file && 'isFile' in file && file.isFile) {
      dispatch(asyncSetSelectedStorageFile(file));
      return;
    }
    //to be replaced with next dynamic routing
    const splitPath = path.split('/');
    if (index === splitPath.length - 1) return;
    if (index && splitPath.length - index >= 2) {
      const newPath = splitPath.slice(0, index);
      handlePathClick(`${newPath.join('/')}/${item}`);
      return;
    }
    if (index === 0) {
      handlePathClick('/');
      return;
    }
    if (splitPath[1]) {
      handlePathClick(`${path}/${item}`);
      return;
    }
    handlePathClick(`${path}${item}`);
  };

  return (
    <>
      <Grid container item xs={12} className={classes.topContainer}>
        <Grid item className={classes.pathContainer}>
          {path.split('/').map((item, index) => {
            return (
              <Typography
                variant="subtitle1"
                className={item || index === 0 ? classes.pathItem : undefined}
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
            onClick={() => handleCreateContainer()}>
            Create Container
          </Button>
          <Button
            variant="contained"
            color="primary"
            className={classes.createButton}
            startIcon={<AddCircleOutline />}
            disabled={path === '/'}
            onClick={() => handleCreateFolder()}>
            Create Folder
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddCircleOutline />}
            disabled={path === '/'}
            onClick={() => handleAdd()}>
            Add
          </Button>
        </Grid>
      </Grid>
      <DataTable
        dsData={formatData()}
        actions={actions}
        handleAction={handleAction}
        selectable={false}
        handleRowClick={(value) => onPathClick(value.Name)}
        headers={path === '/' ? containerHeaders : headers}
        tableRowProps={{
          className: classes.tableRow,
        }}
        placeholder={placeholder}
      />
      {!placeholder && (
        <Grid container style={{ marginTop: '-8px' }}>
          <Grid item xs={7} />
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
      )}
    </>
  );
};

export default StorageTable;

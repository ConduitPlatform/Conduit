import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import StorageTable from './StorageTable';
import {
  asyncGetStorageContainerData,
  asyncGetStorageContainers,
  asyncGetStorageFiles,
} from '../../redux/slices/storageSlice';
import StorageCreateDrawer from './StorageCreateDrawer';
import StorageAddDrawer from './StorageAddDrawer';

const useStyles = makeStyles(() => ({}));

const StorageFiles = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const {
    containers: { containers, containersCount },
    containerData: { data, totalCount },
  } = useAppSelector((state) => state.storageSlice.data);

  const [path, setPath] = useState<string>('/');
  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [drawerCreateOpen, setDrawerCreateOpen] = useState<boolean>(false);
  const [drawerAddOpen, setDrawerAddOpen] = useState<boolean>(false);

  useEffect(() => {
    if (path === '/') {
      dispatch(asyncGetStorageContainers({ skip, limit }));
      return;
    }
    dispatch(
      asyncGetStorageContainerData({
        skip: skip,
        limit: limit,
        container: 'conduit',
        folder: '',
      })
    );
  }, [dispatch, limit, path, skip]);

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

  const handlePathClick = (value: string) => {
    setPath(value);
  };

  return (
    <>
      <StorageTable
        data={path === '/' ? containers : data}
        path={path}
        handleAdd={handleAddFile}
        handleCreate={handleCreate}
        handlePathClick={handlePathClick}
      />
      <StorageCreateDrawer
        open={drawerCreateOpen}
        closeDrawer={handleCloseDrawer}
        containers={containers}
      />
      <StorageAddDrawer
        open={drawerAddOpen}
        closeDrawer={handleCloseDrawer}
        containers={containers}
      />
    </>
  );
};

export default StorageFiles;

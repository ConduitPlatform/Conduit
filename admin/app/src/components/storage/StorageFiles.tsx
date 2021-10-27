import React, { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import StorageTable from './StorageTable';
import {
  asyncAddStorageFile,
  asyncDeleteStorageContainer,
  asyncDeleteStorageFile,
  asyncDeleteStorageFolder,
  asyncGetStorageContainerData,
  asyncGetStorageContainers,
  setSelectedFile,
} from '../../redux/slices/storageSlice';
import StorageCreateDrawer from './StorageCreateDrawer';
import StorageAddDrawer from './StorageAddDrawer';
import ConfirmationDialog from '../common/ConfirmationDialog';

const StorageFiles = () => {
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
  const [edit, setEdit] = useState<boolean>(false);
  const dialogInitialState = {
    open: false,
    title: '',
    description: '',
    id: '',
    container: '',
    type: '',
  };
  const [dialog, setDialog] = useState(dialogInitialState);

  const getContainers = useCallback(() => {
    dispatch(asyncGetStorageContainers({ skip, limit }));
  }, [dispatch, limit, skip]);

  const getContainerData = useCallback(() => {
    const splitPath = path.split('/');
    const filteredSplitPath = splitPath.filter((item) => {
      return item !== '';
    });
    if (filteredSplitPath.length < 1) return;
    dispatch(
      asyncGetStorageContainerData({
        skip: skip,
        limit: limit,
        container: filteredSplitPath[0],
        folder:
          filteredSplitPath.length > 1 ? `${filteredSplitPath[filteredSplitPath.length - 1]}/` : '',
      })
    );
  }, [dispatch, limit, path, skip]);

  useEffect(() => {
    getContainers();
    getContainerData();
  }, [getContainerData, getContainers]);

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

  const handleAddFileAction = (fileData: any) => {
    dispatch(asyncAddStorageFile({ fileData, getContainerData }));
  };

  const handleEditFile = () => {
    setDrawerAddOpen(true);
    setEdit(true);
  };

  const handleDelete = (
    type: 'container' | 'folder' | 'file',
    id: string,
    name: string,
    container?: string
  ) => {
    switch (type) {
      case 'container':
        setDialog({
          type: 'container',
          open: true,
          title: name,
          description: 'Are you sure you want to delete this container?',
          id: id,
          container: '',
        });
        break;
      case 'file':
        setDialog({
          container: '',
          type: 'file',
          id: id,
          open: true,
          title: name,
          description: 'Are you sure you want to delete this file?',
        });
        break;
      case 'folder':
        setDialog({
          container: container ? container : '',
          type: 'folder',
          id: id,
          open: true,
          title: name,
          description: 'Are you sure you want to delete this folder?',
        });
    }
  };

  console.log('dialog', dialog);

  const handleDeleteAction = () => {
    setDialog(dialogInitialState);
    switch (dialog.type) {
      case 'container':
        dispatch(asyncDeleteStorageContainer({ id: dialog.id, name: dialog.title }));
        break;
      case 'file':
        dispatch(asyncDeleteStorageFile(dialog.id));
        break;
      case 'folder':
        dispatch(
          asyncDeleteStorageFolder({
            id: dialog.id,
            name: `${dialog.title}`,
            container: dialog.container ? dialog.container : '',
          })
        );
        break;
    }
  };

  const handleCloseDrawer = () => {
    setDrawerAddOpen(false);
    setDrawerCreateOpen(false);
    dispatch(setSelectedFile(undefined));
  };

  const handlePathClick = (value: string) => {
    setPath(value);
  };

  const handleClose = () => {
    setDialog(dialogInitialState);
  };

  return (
    <>
      <StorageTable
        containers={containers}
        containerData={data}
        path={path}
        handleAdd={handleAddFile}
        handleCreate={handleCreate}
        handleEdit={handleEditFile}
        handlePathClick={handlePathClick}
        handleDelete={handleDelete}
      />
      <StorageCreateDrawer
        open={drawerCreateOpen}
        closeDrawer={handleCloseDrawer}
        containers={containers}
      />
      <StorageAddDrawer
        open={drawerAddOpen}
        edit={edit}
        closeDrawer={handleCloseDrawer}
        containers={containers}
        handleAddFile={handleAddFileAction}
      />
      <ConfirmationDialog
        open={dialog.open}
        handleClose={handleClose}
        title={dialog.title}
        description={dialog.description}
        buttonAction={handleDeleteAction}
        buttonText={'Delete'}
      />
    </>
  );
};

export default StorageFiles;

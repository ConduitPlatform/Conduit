import React, { useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import StorageTable from './StorageTable';
import {
  asyncAddStorageContainer,
  asyncAddStorageFile,
  asyncAddStorageFolder,
  asyncDeleteStorageContainer,
  asyncDeleteStorageFile,
  asyncDeleteStorageFolder,
  asyncGetStorageContainerData,
  asyncGetStorageContainers,
  clearStorageContainerData,
  setContainerDataEmpty,
} from '../../redux/slices/storageSlice';
import StorageCreateDrawer from './StorageCreateDrawer';
import StorageAddDrawer from './StorageAddDrawer';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { CreateFormSelected, ICreateForm, IStorageFile } from '../../models/storage/StorageModels';

const StorageFiles = () => {
  const dispatch = useAppDispatch();

  const {
    containers: { containers, containersCount, areContainersEmpty },
    containerData: { data, totalCount, areContainerDataEmpty },
  } = useAppSelector((state) => state.storageSlice.data);

  const [path, setPath] = useState<string>('/');
  const [filteredPath, setFilteredPath] = useState<string[]>([]);
  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [drawerCreate, setDrawerCreate] = useState({
    open: false,
    type: CreateFormSelected.container,
  });
  const [drawerAdd, setDrawerAdd] = useState<boolean>(false);
  const dialogInitialState = {
    open: false,
    title: '',
    description: '',
    id: '',
    container: '',
    type: '',
  };
  const [dialog, setDialog] = useState(dialogInitialState);
  const [placeholder, setPlaceholder] = useState<string>('');

  const getContainers = useCallback(() => {
    dispatch(asyncGetStorageContainers({ skip, limit }));
  }, [dispatch, limit, skip]);

  const getContainerData = useCallback(() => {
    if (filteredPath.length < 1) {
      dispatch(clearStorageContainerData());
      dispatch(setContainerDataEmpty(false));
      return;
    }
    dispatch(
      asyncGetStorageContainerData({
        skip: skip,
        limit: limit,
        container: filteredPath[0],
        folder: filteredPath.length > 1 ? filteredPath.slice(1).join('/') : '',
      })
    );
  }, [dispatch, filteredPath, limit, skip]);

  useEffect(() => {
    if (filteredPath.length < 1) {
      if (areContainersEmpty) {
        setPlaceholder('No available containers');
        return;
      }
      setPlaceholder('');
      return;
    }
    if (areContainerDataEmpty) {
      setPlaceholder('No available files');
      return;
    }
    setPlaceholder('');
  }, [areContainerDataEmpty, areContainersEmpty, filteredPath.length]);

  useEffect(() => {
    const splitPath = path.split('/');
    const filteredSplitPath = splitPath.filter((item) => {
      return item !== '';
    });
    setFilteredPath(filteredSplitPath);
  }, [path]);

  useEffect(() => {
    getContainers();
    getContainerData();
  }, [getContainerData, getContainers, skip, limit]);

  useEffect(() => {
    setPage(0);
    setSkip(0);
    setLimit(10);
  }, [path]);

  // useEffect(() => {
  //   if (selectedFileUrl) {
  //     window.open(selectedFileUrl, '_blank');
  //   }
  // }, [selectedFileUrl]);

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

  const onCreateContainer = () => {
    setDrawerCreate({
      open: true,
      type: CreateFormSelected.container,
    });
  };

  const onCreateFolder = () => {
    setDrawerCreate({
      open: true,
      type: CreateFormSelected.folder,
    });
  };

  const handleAddFile = () => {
    setDrawerAdd(true);
  };

  const handleAddFileAction = (fileData: IStorageFile) => {
    dispatch(asyncAddStorageFile({ fileData, getContainerData }));
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

  const handleDeleteAction = () => {
    setDialog(dialogInitialState);
    switch (dialog.type) {
      case 'container':
        dispatch(
          asyncDeleteStorageContainer({
            id: dialog.id,
            name: dialog.title,
            getContainers: getContainers,
          })
        );
        break;
      case 'file':
        dispatch(asyncDeleteStorageFile({ id: dialog.id, getContainerData: getContainerData }));
        break;
      case 'folder':
        dispatch(
          asyncDeleteStorageFolder({
            id: dialog.id,
            name: `${dialog.title}`,
            container: dialog.container ? dialog.container : '',
            getContainerData: getContainerData,
          })
        );
        break;
    }
  };

  const handleCloseDrawer = () => {
    setDrawerAdd(false);
    setDrawerCreate({
      open: false,
      type: CreateFormSelected.container,
    });
  };

  const handlePathClick = (value: string) => {
    setPath(value);
  };

  const handleClose = () => {
    setDialog(dialogInitialState);
  };

  const handleCreateFolder = (folderData: ICreateForm['folder']) => {
    dispatch(asyncAddStorageFolder({ folderData, getContainerData }));
  };

  const handleCreateContainer = (containerData: ICreateForm['container']) => {
    dispatch(asyncAddStorageContainer({ containerData, getContainers }));
  };

  return (
    <>
      <StorageTable
        containers={containers}
        containerData={data}
        path={path}
        handleAdd={handleAddFile}
        handleCreateContainer={onCreateContainer}
        handleCreateFolder={onCreateFolder}
        handlePathClick={handlePathClick}
        handleDelete={handleDelete}
        handleLimitChange={handleLimitChange}
        handlePageChange={handlePageChange}
        limit={limit}
        page={page}
        count={path === '/' ? containersCount : totalCount}
        placeholder={placeholder}
      />
      <StorageCreateDrawer
        data={drawerCreate}
        closeDrawer={handleCloseDrawer}
        containers={containers}
        handleCreateFolder={handleCreateFolder}
        handleCreateContainer={handleCreateContainer}
        path={filteredPath}
      />
      <StorageAddDrawer
        open={drawerAdd}
        closeDrawer={handleCloseDrawer}
        containers={containers}
        handleAddFile={handleAddFileAction}
        path={filteredPath}
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

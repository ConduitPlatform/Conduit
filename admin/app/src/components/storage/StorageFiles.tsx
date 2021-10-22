import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import StorageTable from './StorageTable';
import { asyncGetStorageContainers } from '../../redux/slices/storageSlice';

const useStyles = makeStyles(() => ({}));

const StorageFiles = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const {
    containers: { containers, containersCount },
  } = useAppSelector((state) => state.storageSlice.data);

  const [parent, setParent] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [skip, setSkip] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);

  useEffect(() => {
    dispatch(asyncGetStorageContainers({ skip, limit }));
  }, [dispatch, limit, skip]);

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

  return <StorageTable data={containers} />;
};

export default StorageFiles;

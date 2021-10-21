import React, { FC } from 'react';
import { Box, Button } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';
import Dropzone from '../common/Dropzone';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(6),
  },
  saveButton: {
    marginRight: theme.spacing(1),
  },
}));

interface Props {
  open: boolean;
  closeDrawer: () => void;
}

const StorageAddDrawer: FC<Props> = ({ open, closeDrawer }) => {
  const classes = useStyles();

  const handleCancel = () => {
    closeDrawer();
  };

  const handleAdd = () => {
    console.log('handleAdd');
  };

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={256}>
      <Box className={classes.root}>
        <Typography variant="h6">Add File</Typography>
        <Dropzone />
        <Box>
          <Button
            variant="contained"
            color="primary"
            className={classes.saveButton}
            onClick={() => handleAdd()}>
            Add
          </Button>
          <Button variant="outlined" onClick={() => handleCancel()}>
            Cancel
          </Button>
        </Box>
      </Box>
    </DrawerWrapper>
  );
};

export default StorageAddDrawer;

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
  title: {
    marginBottom: theme.spacing(1),
  },
  buttonContainer: {
    marginTop: theme.spacing(2),
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
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={512}>
      <Box className={classes.root}>
        <Typography variant="h6" className={classes.title}>
          Add File
        </Typography>
        <Dropzone />
        <Box className={classes.buttonContainer}>
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

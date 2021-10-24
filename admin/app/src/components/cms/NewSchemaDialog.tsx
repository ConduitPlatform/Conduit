import Box from '@material-ui/core/Box';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import TextField from '@material-ui/core/TextField';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import React, { FC, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Link from 'next/link';
import { useAppDispatch } from '../../redux/store';
import { enqueueInfoNotification } from '../../utils/useNotifier';

const useStyles = makeStyles((theme) => ({
  paper: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  boxType: {
    backgroundColor: 'white',
    height: 300,
    width: 300,
    padding: theme.spacing(5),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  selectedType: {
    backgroundColor: theme.palette.grey[100],
  },
  closeIcon: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
  },
}));

interface Props {
  open: boolean;
  handleClose: () => void;
}

const NewSchemaDialog: FC<Props> = ({ open, handleClose }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();
  const [typeName, setTypeName] = useState('');

  const handleTypeName = (value: string) => {
    const regex = /[^a-z0-9_]/gi;
    if (regex.test(value)) {
      dispatch(enqueueInfoNotification('The schema name can only contain alpharithmetics and _'));
    }

    setTypeName(value.replace(/[^a-z0-9_]/gi, ''));
  };

  const handleAddType = () => {
    setTypeName('');
    handleClose();
  };

  const handleCloseClick = () => {
    setTypeName('');
    handleClose();
  };

  return (
    <Dialog
      fullWidth={true}
      maxWidth={'sm'}
      open={open}
      onClose={handleCloseClick}
      classes={{ paper: classes.paper }}>
      <Box maxWidth={600}>
        <DialogTitle id="new-custom-type" style={{ textAlign: 'center', marginBottom: 16 }}>
          Create new Schema
        </DialogTitle>
        <DialogContent style={{ marginBottom: 16 }}>
          <TextField
            style={{ width: '100%', marginBottom: 16 }}
            id="type-name"
            label="Enter your type name"
            variant="standard"
            value={typeName}
            onChange={(event) => handleTypeName(event.target.value)}
          />
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center' }}>
          <Link
            href={{ pathname: '/cms/build-types', query: { name: typeName } }}
            as={'/cms/build-types'}>
            <a style={{ textDecoration: 'none' }}>
              <Button
                onClick={handleAddType}
                color="primary"
                variant="contained"
                style={{ textTransform: 'none' }}
                disabled={typeName === ''}>
                Create new Schema
              </Button>
            </a>
          </Link>
        </DialogActions>
      </Box>
      <Button onClick={handleCloseClick} className={classes.closeIcon}>
        <CloseIcon />
      </Button>
    </Dialog>
  );
};

export default NewSchemaDialog;

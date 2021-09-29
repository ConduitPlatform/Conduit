import Box from '@material-ui/core/Box';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import TextField from '@material-ui/core/TextField';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import React, { FC, useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import slugify from '../../utils/slugify';
import Link from 'next/link';

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

  const [typeName, setTypeName] = useState('');
  const [typeId, setTypeId] = useState('');

  useEffect(() => {
    const slug = slugify(typeName);
    setTypeId(slug);
  }, [typeName]);

  const handleTypeName = (event: React.ChangeEvent<{ value: any }>) => {
    setTypeName(event.target.value.split(' ').join(''));
  };

  const handleAddType = () => {
    setTypeName('');
    setTypeId('');
    handleClose();
  };

  const handleCloseClick = () => {
    setTypeName('');
    setTypeId('');
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
        <DialogTitle
          id="new-custom-type"
          style={{ textAlign: 'center', marginBottom: 16 }}>
          Create new Schema
        </DialogTitle>
        <DialogContent style={{ marginBottom: 16 }}>
          <TextField
            style={{ width: '100%', marginBottom: 16 }}
            id="type-name"
            label="Enter your type name"
            variant="standard"
            value={typeName}
            onChange={handleTypeName}
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
                disabled={typeName === '' && typeId === ''}>
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

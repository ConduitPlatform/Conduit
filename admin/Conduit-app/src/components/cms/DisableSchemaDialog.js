import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  closeIcon: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
  },
  disableButton: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.common.white,
  },
}));

const DisableSchemaDialog = ({ open, handleClose, handleDisable, selectedSchema }) => {
  const classes = useStyles();

  const dialogText = "You won't be able to create new instances of";
  const dialogTextArray = dialogText.split(' ');

  const handleDisableClick = () => {
    handleDisable();
  };

  return (
    <Dialog fullWidth={true} maxWidth={'md'} open={open} onClose={handleClose}>
      <DialogTitle id="new-custom-type" style={{ marginBottom: 16 }}>
        Disable your custom type?
      </DialogTitle>
      <DialogContent>
        {selectedSchema &&
          dialogTextArray.map((word, index) => {
            if (dialogTextArray.length - 1 === index) {
              return (
                <span style={{ fontWeight: 'bold' }} key={index}>
                  {' '}
                  {selectedSchema.name}.
                </span>
              );
            } else {
              return <span key={index}> {word}</span>;
            }
          })}
      </DialogContent>
      <DialogContent>{"This operation won't delete existing documents."}</DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose()} variant="contained" style={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={handleDisableClick}
          className={classes.disableButton}
          variant="contained"
          style={{ textTransform: 'none' }}>
          Disable
        </Button>
      </DialogActions>
      <Button onClick={handleClose} className={classes.closeIcon}>
        <CloseIcon />
      </Button>
    </Dialog>
  );
};

export default DisableSchemaDialog;

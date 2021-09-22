import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import React, { FC } from 'react';
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
  enableButton: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.common.white,
  },
  deleteButton: {
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.common.white,
  },
}));

interface Props {
  open: boolean;
  handleClose: () => void;
  handleToggle: any;
  handleDelete: any;
  selectedSchema: any;
}

const DisableSchemaDialog: FC<Props> = ({
  open,
  handleClose,
  handleToggle,
  handleDelete,
  selectedSchema,
}) => {
  const classes = useStyles();

  const createDialogTitle = (action: 'enable' | 'disable' | 'delete') => {
    switch (action) {
      case 'enable': {
        return 'Enable CMS schema:';
      }
      case 'disable': {
        return 'Disable CMS schema:';
      }
      case 'delete': {
        return 'Delete CMS schema:';
      }
      default:
        return '';
    }
  };

  const createDialogInfo = (action: 'enable' | 'disable' | 'delete') => {
    switch (action) {
      case 'enable': {
        return 'This operation with enable the schema.';
      }
      case 'disable': {
        return "This operation won't delete existing documents.";
      }
      case 'delete': {
        return 'This operation will erase existing documents.';
      }
      default:
        return '';
    }
  };

  const generateButtonClass = (action: 'enable' | 'disable' | 'delete') => {
    switch (action) {
      case 'enable': {
        return classes.enableButton;
      }
      case 'disable': {
        return classes.disableButton;
      }
      case 'delete': {
        return classes.deleteButton;
      }
      default:
        return null;
    }
  };

  const generateButtonName = (action: 'enable' | 'disable' | 'delete') => {
    switch (action) {
      case 'enable': {
        return 'Enable';
      }
      case 'disable': {
        return 'Disable';
      }
      case 'delete': {
        return 'Delete';
      }
      default:
        return '';
    }
  };

  const handleClick = () => {
    switch (selectedSchema.action) {
      case 'enable':
      case 'disable':
        handleToggle();
        break;
      case 'delete':
        handleDelete();
        break;
      default:
        break;
    }
  };

  return (
    <Dialog fullWidth={true} maxWidth={'md'} open={open} onClose={handleClose}>
      <DialogTitle id="new-custom-type" style={{ marginBottom: 16 }}>
        {createDialogTitle(selectedSchema.action)}
      </DialogTitle>
      <DialogContent>
        <span style={{ fontWeight: 'bold' }}>
          {selectedSchema ? selectedSchema.data.name : ''}
        </span>
      </DialogContent>
      <DialogContent>{createDialogInfo(selectedSchema.action)}</DialogContent>
      <DialogActions>
        <Button
          onClick={() => handleClose()}
          variant="contained"
          style={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={handleClick}
          className={generateButtonClass(selectedSchema.action)}
          variant="contained"
          style={{ textTransform: 'none' }}>
          {generateButtonName(selectedSchema.action)}
        </Button>
      </DialogActions>
      <Button onClick={handleClose} className={classes.closeIcon}>
        <CloseIcon />
      </Button>
    </Dialog>
  );
};

export default DisableSchemaDialog;

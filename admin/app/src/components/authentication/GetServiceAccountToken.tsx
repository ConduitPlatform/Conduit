import React, { useState } from 'react';
import {
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
} from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import FileCopyIcon from '@material-ui/icons/FileCopy';

interface Props {
  token: string;
  open: boolean;
  handleClose: () => void;
}

const GetServiceAccountToken: React.FC<Props> = ({ token, open, handleClose }) => {
  const [checked, setChecked] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(token);
  };

  return (
    <Dialog onClose={handleClose} aria-labelledby="customized-dialog-title" open={open}>
      <DialogTitle id="customized-dialog-title">Service Account Created</DialogTitle>
      <DialogContent dividers>
        <Typography gutterBottom>
          Your new service account has been create successfully!
        </Typography>
        <Typography gutterBottom>
          Please copy and the generated token to use it for authorization purpose.
        </Typography>
        <Box display={'flex'} justifyContent={'center'} padding={1}>
          <Typography
            variant={'h6'}
            align={'center'}
            style={{
              overflowWrap: 'break-word',
              overflow: 'hidden',
            }}>
            {token}
          </Typography>
        </Box>
        <Box display={'flex'} justifyContent={'center'} padding={2}>
          <Button
            size={'large'}
            color={'primary'}
            variant="contained"
            startIcon={<FileCopyIcon />}
            onClick={copyToClipboard}>
            Copy Generated Token
          </Button>
        </Box>
        <Box display={'flex'} justifyContent={'center'}>
          <FormControlLabel
            control={
              <Checkbox
                color={'primary'}
                checked={checked}
                onChange={(e) => {
                  setChecked(e.target.checked);
                }}
                name="coped"
              />
            }
            label="I have copied the generated token"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={handleClose} color="primary" disabled={!checked}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GetServiceAccountToken;

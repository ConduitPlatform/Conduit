import { Button, Grid } from '@material-ui/core';
import React, { FC } from 'react';

interface Props {
  editMode: boolean;
  createMode: boolean;
  disableSubmit: any;
  handleSaveClick: any;
  handleCreateClick: any;
  handleCancelClick: () => void;
}

const SaveSection: FC<Props> = ({
  editMode,
  createMode,
  disableSubmit,
  handleSaveClick,
  handleCreateClick,
  handleCancelClick,
}) => {
  return (
    <Grid container justify="flex-end" spacing={1} style={{ paddingTop: '30px' }}>
      <Grid item xs={4} md={2}>
        <Button variant="contained" color="secondary" onClick={handleCancelClick}>
          Cancel
        </Button>
      </Grid>

      <Grid item xs={4} md={2}>
        <Button
          disabled={disableSubmit}
          variant="contained"
          color="primary"
          onClick={createMode ? handleCreateClick : editMode ? handleSaveClick : ''}>
          {createMode ? 'Create' : editMode ? 'Save' : ''}
        </Button>
      </Grid>
    </Grid>
  );
};

export default SaveSection;

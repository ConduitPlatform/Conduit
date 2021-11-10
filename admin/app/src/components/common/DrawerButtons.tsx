import { Button, Grid } from '@material-ui/core';
import React, { FC } from 'react';
import { Cancel, Save, Edit } from '@material-ui/icons';

interface Props {
  edit: boolean;
  setEdit: (value: boolean) => void;
  handleCancelClick: () => void;
  handleSaveClick: () => void;
  handleDisabled?: any;
}

const DrawerButtons: FC<Props> = ({
  edit,
  setEdit,
  handleCancelClick,
  handleSaveClick,
  handleDisabled,
}) => {
  return (
    <>
      <Grid container item xs={12} justify="space-around" style={{ marginTop: '35px' }}>
        {!edit ? (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Edit />}
            onClick={() => setEdit(true)}>
            Edit
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Cancel />}
              onClick={handleCancelClick}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Save />}
              onClick={handleSaveClick}>
              Save
            </Button>
          </>
        )}
      </Grid>
    </>
  );
};

export default DrawerButtons;

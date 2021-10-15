import { Container } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { FormSettingsConfig } from '../../models/forms/FormsModels';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  innerGrid: {
    paddingLeft: theme.spacing(4),
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: '100%',
  },
}));

interface Props {
  handleSave: (data: FormSettingsConfig) => void;
  settingsData: FormSettingsConfig;
}

const FormsSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState<boolean>(false);
  const [settingsState, setSettingsState] = useState<FormSettingsConfig>({
    active: false,
    useAttachments: false,
  });

  useEffect(() => {
    if (!settingsData) {
      return;
    }
    setSettingsState({
      active: settingsData.active,
      useAttachments: settingsData.useAttachments,
    });
  }, [settingsData]);

  const handleCancel = () => {
    setEdit(false);
    setSettingsState({
      active: settingsData.active,
      useAttachments: settingsData.useAttachments,
    });
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const save = () => {
    const data = {
      active: settingsState.active,
      useAttachments: settingsData.useAttachments,
    };
    setEdit(false);
    handleSave(data);
  };

  const renderSettingsFields = () => {
    return (
      <>
        <Grid item xs={12}>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'h6'}>Use Attachments</Typography>
            <FormControlLabel
              label={''}
              control={
                <Switch
                  disabled={!edit}
                  checked={settingsState.useAttachments}
                  onChange={() => {
                    setSettingsState({
                      ...settingsState,
                      useAttachments: !settingsState.useAttachments,
                    });
                  }}
                  value={'useAttachments'}
                  color="primary"
                />
              }
            />
          </Box>
        </Grid>
      </>
    );
  };

  return (
    <Container>
      <Paper className={classes.paper}>
        <Grid container>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'h6'}>Activate Forms Module</Typography>
            <FormControlLabel
              control={
                <Switch
                  disabled={!edit}
                  checked={settingsState.active}
                  onChange={() =>
                    setSettingsState({
                      ...settingsState,
                      active: !settingsState.active,
                    })
                  }
                  value={'accountLinking'}
                  color="primary"
                />
              }
              label={''}
            />
          </Box>

          <Divider className={classes.divider} />

          <Grid container spacing={2} className={classes.innerGrid}>
            {settingsState.active && renderSettingsFields()}
          </Grid>
          {edit && (
            <Grid item container xs={12} justify={'flex-end'}>
              <Button onClick={() => handleCancel()} style={{ marginRight: 16 }} color={'primary'}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => save()}>
                Save
              </Button>
            </Grid>
          )}
          {!edit && (
            <Grid item container xs={12} justify={'flex-end'}>
              <Button
                onClick={() => handleEditClick()}
                style={{ marginRight: 16 }}
                color={'primary'}>
                Edit
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Container>
  );
};

export default FormsSettings;

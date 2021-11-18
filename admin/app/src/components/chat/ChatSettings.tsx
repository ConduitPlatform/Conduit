import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Container, FormControlLabel, Switch } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { IChatConfig } from '../../models/chat/ChatModels';

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
  config: IChatConfig;
  handleSave: (data: IChatConfig) => void;
}

const ChatSettings: React.FC<Props> = ({ config, handleSave }) => {
  const classes = useStyles();
  const initialSettingsState = {
    active: false,
    allowMessageDelete: false,
    allowMessageEdit: false,
  };
  const [settingsState, setSettingsState] = useState<IChatConfig>(initialSettingsState);

  useEffect(() => {
    if (!config) {
      return;
    }
    setSettingsState(config);
  }, [config]);

  const handleCancel = () => {
    if (config) {
      setSettingsState(config);
    } else {
      setSettingsState(initialSettingsState);
    }
  };

  const save = () => {
    handleSave(settingsState);
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
            <Typography variant={'h6'}>Activate Chat Module</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settingsState.active}
                  onChange={(event) =>
                    setSettingsState({
                      ...settingsState,
                      active: event.target.checked,
                    })
                  }
                  color="primary"
                />
              }
              label={''}
            />
          </Box>
          <Divider className={classes.divider} />
          <Grid container spacing={2} className={classes.innerGrid}>
            {settingsState.active && (
              <>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settingsState.allowMessageEdit}
                        onChange={(event) =>
                          setSettingsState({
                            ...settingsState,
                            allowMessageEdit: event.target.checked,
                          })
                        }
                        color="primary"
                      />
                    }
                    label={'Allow message edit'}
                    labelPlacement="end"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settingsState.allowMessageDelete}
                        onChange={(event) =>
                          setSettingsState({
                            ...settingsState,
                            allowMessageDelete: event.target.checked,
                          })
                        }
                        color="primary"
                      />
                    }
                    label={'Allow message delete'}
                    labelPlacement="end"
                  />
                </Grid>
              </>
            )}
          </Grid>
          <Grid item container xs={12} justify={'flex-end'} style={{ marginTop: 16 }}>
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
        </Grid>
      </Paper>
    </Container>
  );
};

export default ChatSettings;

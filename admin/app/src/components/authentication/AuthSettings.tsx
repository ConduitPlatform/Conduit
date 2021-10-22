import { Container } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import InputAdornment from '@material-ui/core/InputAdornment';
import { Visibility, VisibilityOff } from '@material-ui/icons';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import { SettingsStateTypes, SignInMethods } from '../../models/authentication/AuthModels';
import ConfirmationDialog from '../common/ConfirmationDialog';

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
  handleSave: (data: SettingsStateTypes) => void;
  settingsData: SignInMethods | null;
}

const AuthSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState<boolean>(false);
  const [settingsState, setSettingsState] = useState<SettingsStateTypes>({
    active: false,
    generateRefreshToken: false,
    rateLimit: 3,
    tokenInvalidationPeriod: 10000,
    refreshTokenInvalidationPeriod: 10000,
    jwtSecret: '',
    showSecret: false,
  });
  const [openSaveDialog, setOpenSaveDialog] = useState<boolean>(false);

  useEffect(() => {
    if (!settingsData) {
      return;
    }
    setSettingsState({
      active: settingsData.active,
      generateRefreshToken: settingsData.generateRefreshToken,
      rateLimit: settingsData.rateLimit,
      tokenInvalidationPeriod: settingsData.tokenInvalidationPeriod,
      refreshTokenInvalidationPeriod: settingsData.refreshTokenInvalidationPeriod,
      jwtSecret: settingsData.jwtSecret,
      showSecret: false,
    });
  }, [settingsData]);

  const handleCancel = () => {
    if (!settingsData) {
      return;
    }
    setEdit(false);
    setSettingsState({
      active: settingsData.active,
      generateRefreshToken: settingsData.generateRefreshToken,
      rateLimit: settingsData.rateLimit,
      tokenInvalidationPeriod: settingsData.tokenInvalidationPeriod,
      refreshTokenInvalidationPeriod: settingsData.refreshTokenInvalidationPeriod,
      jwtSecret: settingsData.jwtSecret,
      showSecret: false,
    });
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const save = () => {
    const data = {
      active: settingsState.active,
      generateRefreshToken: settingsState.generateRefreshToken,
      rateLimit: settingsState.rateLimit,
      tokenInvalidationPeriod: settingsState.tokenInvalidationPeriod,
      refreshTokenInvalidationPeriod: settingsState.refreshTokenInvalidationPeriod,
      jwtSecret: settingsState.jwtSecret,
    };
    setEdit(false);
    handleSave(data);
    setOpenSaveDialog(false);
  };

  const handleClickShowPassword = () => {
    setSettingsState({ ...settingsState, showSecret: !settingsState.showSecret });
  };

  const handleMouseDownPassword = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  const renderSettingsFields = () => {
    return (
      <>
        <Grid item xs={12}>
          <Typography variant={'h6'}>Limit the authentication tries/requests of clients</Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            disabled={!edit}
            id="outlined-number"
            label="Retries Limit"
            type="number"
            variant="outlined"
            InputLabelProps={{
              shrink: true,
            }}
            onChange={(event) => {
              setSettingsState({
                ...settingsState,
                rateLimit: Number(event.target.value),
              });
            }}
            value={settingsState.rateLimit}
          />
        </Grid>
        <Grid item xs={6}>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'h6'}>Allow Refresh Token generation</Typography>
            <FormControlLabel
              label={''}
              control={
                <Switch
                  disabled={!edit}
                  checked={settingsState.generateRefreshToken}
                  onChange={() => {
                    setSettingsState({
                      ...settingsState,
                      generateRefreshToken: !settingsState.generateRefreshToken,
                    });
                  }}
                  value={'accountLinking'}
                  color="primary"
                />
              }
            />
          </Box>
        </Grid>
        <Grid item xs={6} />
        <Box width={'100%'}>
          <Divider className={classes.divider} />
        </Box>
        <Grid item xs={6}>
          <Typography variant={'h6'}>Token expire period</Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant={'h6'}>Refresh token expire period</Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField
            disabled={!edit}
            required
            id="tokenPeriod"
            type={'number'}
            label="Expire Period (sec)"
            variant="outlined"
            value={settingsState.tokenInvalidationPeriod}
            onChange={(event) => {
              setSettingsState({
                ...settingsState,
                tokenInvalidationPeriod: Number(event.target.value),
              });
            }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            disabled={!edit}
            required
            id="refreshTokenPeriod"
            type={'number'}
            label="Expire Period (sec)"
            variant="outlined"
            value={settingsState.refreshTokenInvalidationPeriod}
            onChange={(event) => {
              setSettingsState({
                ...settingsState,
                refreshTokenInvalidationPeriod: Number(event.target.value),
              });
            }}
          />
        </Grid>
        <Box width={'100%'}>
          <Divider className={classes.divider} />
        </Box>
        <Grid item xs={6}>
          <Typography variant={'h6'}>JWT Secret</Typography>
        </Grid>
        <Grid item xs={6} />
        <Grid item xs={6}>
          <TextField
            disabled={!edit}
            required
            id="jwtSecret"
            type={settingsState.showSecret ? 'text' : 'password'}
            label="JWT Secret"
            variant="outlined"
            value={settingsState.jwtSecret}
            onChange={(event) => {
              setSettingsState({
                ...settingsState,
                jwtSecret: event.target.value,
              });
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    edge="end"
                    onClick={handleClickShowPassword}
                    onMouseDown={handleMouseDownPassword}>
                    {settingsState.showSecret ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
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
            <Typography variant={'h6'}>Activate Authentication Module</Typography>
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
                onClick={() => setOpenSaveDialog(true)}>
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
      <ConfirmationDialog
        open={openSaveDialog}
        handleClose={() => setOpenSaveDialog(false)}
        title={'Are you sure you want to proceed?'}
        description={'Authentication settings changed'}
        buttonAction={save}
        buttonText={'Proceed'}
      />
    </Container>
  );
};

export default AuthSettings;

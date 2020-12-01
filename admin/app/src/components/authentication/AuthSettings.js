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

const AuthSettings = ({ handleSave, settingsData, error }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState(false);
  const [settingsState, setSettingsSate] = useState({
    enabled: false,
    generateRefreshToken: false,
    rateLimit: 3,
    tokenInvalidationPeriod: 10000,
    refreshTokenInvalidationPeriod: 10000,
    jwtSecret: '',
    showSecret: false,
  });

  useEffect(() => {
    if (!settingsData) {
      return;
    }
    setSettingsSate({
      enabled: settingsData.active,
      generateRefreshToken: settingsData.generateRefreshToken,
      rateLimit: settingsData.rateLimit,
      tokenInvalidationPeriod: settingsData.tokenInvalidationPeriod,
      refreshTokenInvalidationPeriod: settingsData.refreshTokenInvalidationPeriod,
      jwtSecret: settingsData.jwtSecret,
    });
  }, [settingsData, error]);

  const handleCancel = () => {
    setEdit(false);
    setSettingsSate({
      enabled: settingsData.active,
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
      active: settingsState.enabled,
      generateRefreshToken: settingsState.generateRefreshToken,
      rateLimit: settingsState.rateLimit,
      tokenInvalidationPeriod: settingsState.tokenInvalidationPeriod,
      refreshTokenInvalidationPeriod: settingsState.refreshTokenInvalidationPeriod,
      jwtSecret: settingsState.jwtSecret,
    };
    setEdit(false);
    handleSave(data);
  };

  const handleClickShowPassword = () => {
    setSettingsSate({ ...settingsState, showSecret: !settingsState.showSecret });
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const renderSettingsFields = () => {
    return (
      <>
        <Grid item xs={12}>
          <Typography variant={'h6'}>
            Limit the authentication tries/requests of clients
          </Typography>
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
              setSettingsSate({
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
                    setSettingsSate({
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
              setSettingsSate({
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
              setSettingsSate({
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
              setSettingsSate({
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
                  checked={settingsState.enabled}
                  onChange={() =>
                    setSettingsSate({
                      ...settingsState,
                      enabled: !settingsState.enabled,
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
            {settingsState.enabled && renderSettingsFields()}
          </Grid>
          {edit && (
            <Grid item container xs={12} justify={'flex-end'}>
              <Button
                onClick={() => handleCancel()}
                style={{ marginRight: 16 }}
                color={'primary'}>
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

export default AuthSettings;

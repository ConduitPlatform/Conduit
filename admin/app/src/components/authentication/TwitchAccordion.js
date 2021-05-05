import AccordionSummary from '@material-ui/core/AccordionSummary';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import clsx from 'clsx';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Accordion from '@material-ui/core/Accordion';
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
  },
  titleContent: {
    backgroundColor: theme.palette.grey[200],
    height: theme.spacing(6),
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  expandedPanel: {
    '&.MuiAccordion-root.Mui-expanded': {
      marginTop: 0,
    },
  },
  details: {
    borderTop: '1px solid',
    borderColor: 'rgb(217, 217, 217)',
  },
  typography: {
    flex: 1,
  },
  statusEnabled: {
    color: 'green',
  },
  statusDisabled: {
    color: 'red',
  },
}));

const TwitchAccordion = ({
  twitch,
  children,
  expanded,
  setTwitch,
  openExpanded,
  handleTwitchClientId,
  handleTwitchRedirectUri,
  handleTwitchClientSecret,
}) => {
  const classes = useStyles();

  return (
    <Accordion
      expanded={expanded.includes('twitch')}
      onChange={() => openExpanded('twitch')}>
      <AccordionSummary id={'twitch'}>
        <Box display={'flex'} alignItems={'center'} flex={1}>
          <Typography variant={'subtitle2'} className={classes.typography}>
            Twitch
          </Typography>
          <Typography
            variant={'subtitle2'}
            className={
              twitch.enabled
                ? clsx(classes.typography, classes.statusEnabled)
                : clsx(classes.typography, classes.statusDisabled)
            }>
            {twitch.enabled ? 'Enabled' : 'Disabled'}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails classes={{ root: classes.details }}>
        <Box
          display={'flex'}
          flexDirection={'column'}
          justifyContent={'space-between'}
          alignItems={'center'}
          width={'100%'}>
          <Box
            mb={2}
            maxWidth={800}
            display={'flex'}
            width={'100%'}
            flexDirection={'column'}
            alignItems={'center'}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Allow users to sign up using their Twitch account.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={twitch.enabled}
                    onChange={() =>
                      setTwitch({
                        ...twitch,
                        enabled: !twitch.enabled,
                      })
                    }
                    value={'twitch'}
                    color="primary"
                  />
                }
                label={twitch.enabled ? 'Enabled' : 'Disabled'}
              />
            </Box>
            <Box width={'100%'} mt={2}>
              <Grid container item xs={8}>
                <TextField
                  style={{ width: '100%', marginBottom: 8 }}
                  id="twitch-id"
                  label="Client ID"
                  variant="outlined"
                  value={twitch.clientId}
                  onChange={handleTwitchClientId}
                  disabled={!twitch.enabled}
                />
              </Grid>
            </Box>
            <Box width={'100%'} mt={2}>
              <Grid container item xs={8}>
                <TextField
                  style={{ width: '100%', marginBottom: 8 }}
                  id="twitch-redirectUri-id"
                  label="Redirect Uri"
                  variant="outlined"
                  value={twitch.redirect_uri}
                  onChange={handleTwitchRedirectUri}
                  disabled={!twitch.enabled}
                />
              </Grid>
            </Box>
            <Box width={'100%'} mt={2}>
              <Grid container item xs={8}>
                <TextField
                  style={{ width: '100%', marginBottom: 8 }}
                  id="twitch-clientSecret"
                  label="Client Secret"
                  variant="outlined"
                  value={twitch.clientSecret}
                  onChange={handleTwitchClientSecret}
                  disabled={!twitch.enabled}
                />
              </Grid>
            </Box>
          </Box>
          <Box alignSelf={'flex-end'}>{children}</Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default TwitchAccordion;

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
import React, { ChangeEvent } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { SocialNameTypes, FacebookTypes } from '../../models/authentication/AuthModels';

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
    color: theme.palette.secondary.main,
  },
  statusDisabled: {
    color: theme.palette.primary.main,
  },
}));

interface Props {
  expanded: SocialNameTypes[];
  facebook: FacebookTypes;
  setFacebook: (values: FacebookTypes) => void;
  openExpanded: (value: SocialNameTypes) => void;
  handleFacebookClientID: (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => void;
}

const FacebookAccordion: React.FC<Props> = ({
  children,
  expanded,
  facebook,
  setFacebook,
  openExpanded,
  handleFacebookClientID,
}) => {
  const classes = useStyles();

  return (
    <Accordion
      expanded={expanded.includes('facebook')}
      onChange={() => openExpanded('facebook')}>
      <AccordionSummary id={'email'}>
        <Box display={'flex'} alignItems={'center'} flex={1}>
          <Typography variant={'subtitle2'} className={classes.typography}>
            Facebook
          </Typography>
          <Typography
            variant={'subtitle2'}
            className={
              facebook.enabled
                ? clsx(classes.typography, classes.statusEnabled)
                : clsx(classes.typography, classes.statusDisabled)
            }>
            {facebook.enabled ? 'Enabled' : 'Disabled'}
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
                Allow users to sign up using their facebook account.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={facebook.enabled}
                    onChange={() =>
                      setFacebook({
                        ...facebook,
                        enabled: !facebook.enabled,
                      })
                    }
                    value={'facebook'}
                    color="primary"
                  />
                }
                label={facebook.enabled ? 'Enabled' : 'Disabled'}
              />
            </Box>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'overline'} style={{ width: '100%' }}>
                Allow account linking
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={facebook.accountLinking}
                    onChange={() =>
                      setFacebook({
                        ...facebook,
                        accountLinking: !facebook.accountLinking,
                      })
                    }
                    value={'accountLinking'}
                    color="primary"
                  />
                }
                label={facebook.accountLinking ? 'Enabled' : 'Disabled'}
                disabled={!facebook.enabled}
              />
            </Box>
            <Box width={'100%'} mt={2}>
              <Grid container item xs={8}>
                <TextField
                  style={{ width: '100%', marginBottom: 8 }}
                  id="facebook-id"
                  label="Client ID"
                  variant="outlined"
                  value={facebook.clientId}
                  onChange={handleFacebookClientID}
                  disabled={!facebook.enabled}
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
export default FacebookAccordion;

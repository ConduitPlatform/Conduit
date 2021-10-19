import React, { useState } from 'react';
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
import { makeStyles } from '@material-ui/core/styles';
import { Button, InputLabel, MenuItem, Select } from '@material-ui/core';
import FormControl from '@material-ui/core/FormControl';
import {
  SignInMethods,
  SignInTypes,
  SocialNameTypes,
} from '../../models/authentication/AuthModels';

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
      marginTop: '20px',
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
  name: SocialNameTypes;
  setAccProps: any;
  handleData: (type: SocialNameTypes, data: SignInTypes) => void;
  configData: SignInMethods;
  accProps: SignInTypes;
}

const ReusableAccordion: React.FC<Props> = ({
  setAccProps,
  name,
  handleData,
  configData,
  accProps,
}) => {
  const classes = useStyles();

  const [expanded, setExpanded] = useState<boolean>(false);

  const handleCancel = () => {
    if (configData && configData[name]) setAccProps(configData[name]);
    setExpanded(false);
  };

  const handleSubmit = (type: SocialNameTypes, data: SignInTypes) => {
    handleData(type, data);
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      style={{ cursor: 'default' }}
      classes={{ root: classes.expandedPanel }}>
      <AccordionSummary id={'local'}>
        <Box display={'flex'} alignItems={'center'} flex={1}>
          <Typography variant={'subtitle2'} className={classes.typography}>
            {name}
          </Typography>
          <Typography
            variant={'subtitle2'}
            className={
              accProps.enabled
                ? clsx(classes.typography, classes.statusEnabled)
                : clsx(classes.typography, classes.statusDisabled)
            }>
            {accProps.enabled ? 'Enabled' : 'Disabled'}
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
                Allow users to sign up using their {name} account.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={accProps.enabled}
                    onChange={() =>
                      setAccProps({
                        ...accProps,
                        enabled: !accProps.enabled,
                      })
                    }
                    value={'enabled'}
                    color="primary"
                  />
                }
                label={accProps.enabled ? 'Enabled' : 'Disabled'}
              />
            </Box>
            {accProps &&
              Object.entries(accProps).map(([key, value]) => {
                if (typeof value === 'boolean' && key !== 'enabled') {
                  return (
                    <Box
                      width={'100%'}
                      key={key}
                      display={'inline-flex'}
                      justifyContent={'space-between'}
                      alignItems={'center'}>
                      <Typography variant={'overline'} style={{ width: '100%' }}>
                        {key.split(/(?=[A-Z])/).join(' ')}
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={value}
                            name={key}
                            onChange={() =>
                              setAccProps({
                                ...accProps,
                                [key]: !value,
                              })
                            }
                            value={value}
                            color="primary"
                          />
                        }
                        label={value ? 'Enabled' : 'Disabled'}
                        disabled={!accProps.enabled || accProps?.identifier === 'username'}
                      />
                    </Box>
                  );
                }
              })}
            {accProps.identifier !== undefined ? (
              <Box width={'100%'} mt={2}>
                <Grid container item xs={8}>
                  <FormControl variant="outlined" fullWidth>
                    <InputLabel id="identifier-label">Identifier</InputLabel>
                    <Select
                      id="identifier-id"
                      labelId="identifier-label"
                      name="identifier"
                      style={{ width: '100%', marginBottom: 8 }}
                      value={accProps.identifier}
                      placeholder={'identifier'}
                      disabled={!accProps.enabled}
                      onChange={(e) =>
                        setAccProps({
                          ...accProps,
                          identifier: e.target.value,
                        })
                      }
                      label="Identifier">
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      <MenuItem value={'email'}>email</MenuItem>
                      <MenuItem value={'username'}>username</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Box>
            ) : (
              ''
            )}
            {Object.entries(accProps).map(([key, value]) => {
              if (typeof value === 'string' && key !== 'identifier') {
                return (
                  <Box width={'100%'} mt={2} key={key}>
                    <Grid container item xs={8}>
                      <TextField
                        style={{ width: '100%', marginBottom: 8 }}
                        id={key}
                        label={key
                          .split(/(?=[A-Z&])/)
                          .join(' ')
                          .replaceAll('_', ' ')}
                        name={key}
                        variant="outlined"
                        value={value}
                        onChange={(e) =>
                          setAccProps({
                            ...accProps,
                            [e.target.name]: e.target.value.replace(/\s/g, ''),
                          })
                        }
                        placeholder={key}
                        disabled={!accProps.enabled}
                      />
                    </Grid>
                  </Box>
                );
              }
            })}
          </Box>
          <Box alignSelf={'flex-end'}>
            <Button onClick={() => handleCancel()} style={{ marginRight: 16 }} color={'primary'}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              style={{ alignSelf: 'flex-end' }}
              onClick={() => handleSubmit(name, accProps)}>
              Save
            </Button>
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default ReusableAccordion;

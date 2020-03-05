import React, {useEffect, useState} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import Typography from '@material-ui/core/Typography';
import Box from "@material-ui/core/Box";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%'
  },
  titleContent: {
    backgroundColor: theme.palette.grey[200],
    height: theme.spacing(6),
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  expandedPanel: {
    '&.MuiExpansionPanel-root.Mui-expanded': {
      marginTop: 0
    }
  },
  details: {
    minHeight: theme.spacing(20),
    borderTop: '1px solid',
    borderColor: 'rgb(217, 217, 217)'
  },
  green: {
    color: 'green'
  },
  red: {
    color: 'red'
  }
}));

export default function AuthAccordion(props) {
  const {data, handleData, ...rest} = props;
  const classes = useStyles();
  const [expanded, setExpanded] = useState([]);

  const [email, setEmail] = useState({
    enabled: false
  });

  const [phone, setPhone] = useState({
    enabled: false
  });

  const [google, setGoogle] = useState({
    enabled: false, id: '', secret: ''
  });

  const [facebook, setFacebook] = useState({
    enabled: false, id: '', secret: ''
  });

  useEffect(() => {
    if (data) {
      if (data.email) {
        setEmail({...email, enabled: data.email.enabled});
      }
      if (data.phone) {
        setPhone({...phone, enabled: data.phone.enabled});
      }
      if (data.google) {
        setGoogle({...google, enabled: data.google.enabled, id: data.google.id, secret: data.google.secret});
      }
      if (data.facebook) {
        setFacebook({...facebook, enabled: data.facebook.enabled, id: data.facebook.id, secret: data.facebook.secret});
      }
    }
  }, [data]);

  const handleGoogleID = event => {
    setGoogle({...google, id: event.target.value});
  };

  const handleGoogleSecret = event => {
    setGoogle({...google, secret: event.target.value});
  };

  const handleFacebookID = event => {
    setFacebook({...facebook, id: event.target.value});
  };

  const handleFacebookSecret = event => {
    setFacebook({...facebook, secret: event.target.value});
  };

  const openExpanded = type => {
    if (!expanded.includes(type)) {
      const newExpanded = [...expanded];
      newExpanded.push(type);
      setExpanded(newExpanded);
    }
  };

  const closeExpanded = type => {
    if (type !== undefined && expanded && expanded.includes(type)) {
      const newExpanded = [...expanded];
      const arrayIndex = newExpanded.indexOf(type);
      newExpanded.splice(arrayIndex, 1);
      setExpanded(newExpanded);
    }
  };

  const handleSubmit = (type, data) => {
    handleData(type, data);
    closeExpanded(type)
  };

  const handleCancel = (type) => {
    switch (type) {
      case 'email':
        setEmail(data.email);
        break;
      case 'phone':
        setPhone(data.phone);
        break;
      case 'google':
        setGoogle(data.google);
        break;
      case 'facebook':
        setFacebook(data.facebook);
        break;
      default:
        return null
    }
    closeExpanded(type)
  };

  const expansionPanelGenerator = (providerData) => {
    if (!providerData) {
      return
    }
    switch (providerData) {
      case email:
        return (
          <ExpansionPanel
            expanded={expanded.includes('email')}
            onChange={() => openExpanded('email')}
            style={{cursor: 'default'}}
            classes={{root: classes.expandedPanel}}>
            <ExpansionPanelSummary
              id={'email'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={"subtitle2"} style={{flex: 1}}>
                  Email
                </Typography>
                <Typography variant={"subtitle2"} style={{flex: 1}}
                            className={data.email.enabled ? classes.green : classes.red}>
                  {data.email.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </ExpansionPanelSummary>
            <ExpansionPanelDetails classes={{root: classes.details}}>
              <Box display={'flex'} flexDirection={'column'} justifyContent={'space-between'} alignItems={'center'}
                   width={'100%'}>
                <Box mb={4} display={'flex'} maxWidth={800} width={'100%'} flexDirection={'column'}
                     justifyContent={'flex-end'} alignItems={'center'}>
                  <FormControlLabel
                    style={{alignSelf: 'flex-end', marginBottom: 32}}
                    control={
                      <Switch
                        checked={email.enabled}
                        onChange={() => setEmail({...email, enabled: !email.enabled})}
                        value={'email'}
                        color="primary"
                      />
                    }
                    label={providerData.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <Box width={'100%'}>
                    <Typography variant={"subtitle2"} style={{width: '100%', marginBottom: 16}}>
                      Allow users to sign up using their email addresses and password.
                    </Typography>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button onClick={() => handleCancel('email')} style={{marginRight: 16}}
                          color={'primary'}>Cancel</Button>
                  <Button variant="contained" color="primary" style={{alignSelf: 'flex-end'}}
                          onClick={() => handleSubmit('email', email)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </ExpansionPanelDetails>
          </ExpansionPanel>
        );

      case phone:
        return (
          <ExpansionPanel
            expanded={expanded.includes('phone')}
            onChange={() => openExpanded('phone')}>
            <ExpansionPanelSummary
              id={'phone'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={"subtitle2"} style={{flex: 1}}>
                  Phone
                </Typography>
                <Typography variant={"subtitle2"} style={{flex: 1}}
                            className={data.phone.enabled ? classes.green : classes.red}>
                  {data.phone.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </ExpansionPanelSummary>
            <ExpansionPanelDetails classes={{root: classes.details}}>
              <Box display={'flex'} flexDirection={'column'} justifyContent={'space-between'} alignItems={'center'}
                   width={'100%'}>
                <Box mb={4} display={'flex'} maxWidth={800} width={'100%'} flexDirection={'column'}
                     justifyContent={'flex-end'} alignItems={'center'}>
                  <FormControlLabel
                    style={{alignSelf: 'flex-end', marginBottom: 32}}
                    control={
                      <Switch
                        checked={phone.enabled}
                        onChange={() => setPhone({...phone, enabled: !phone.enabled})}
                        value={'email'}
                        color="primary"
                      />
                    }
                    label={providerData.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <Box width={'100%'}>
                    <Typography variant={"subtitle2"} style={{width: '100%', marginBottom: 16}}>
                      Allow users to sign up using their mobile phone.
                    </Typography>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button onClick={() => handleCancel('phone')} style={{marginRight: 16}}
                          color={'primary'}>Cancel</Button>
                  <Button variant="contained" color="primary" style={{alignSelf: 'flex-end'}}
                          onClick={() => handleSubmit('phone', phone)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </ExpansionPanelDetails>
          </ExpansionPanel>
        );

      case google:
        return (
          <ExpansionPanel
            expanded={expanded.includes('google')}
            onChange={() => openExpanded('google')}>
            <ExpansionPanelSummary
              id={'google'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={"subtitle2"} style={{flex: 1}}>
                  Google
                </Typography>
                <Typography variant={"subtitle2"} style={{flex: 1}}
                            className={data.google.enabled ? classes.green : classes.red}>
                  {data.google.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </ExpansionPanelSummary>
            <ExpansionPanelDetails classes={{root: classes.details}}>
              <Box display={'flex'} flexDirection={'column'} justifyContent={'space-between'} alignItems={'center'}
                   width={'100%'}>
                <Box mb={4} display={'flex'} maxWidth={800} width={'100%'} flexDirection={'column'}
                     justifyContent={'flex-end'} alignItems={'center'}>
                  <FormControlLabel
                    style={{alignSelf: 'flex-end', marginBottom: 32}}
                    control={
                      <Switch
                        checked={google.enabled}
                        onChange={() => setGoogle({...google, enabled: !google.enabled})}
                        value={'email'}
                        color="primary"
                      />
                    }
                    label={providerData.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <Box width={'100%'}>
                    <TextField style={{width: '100%', marginBottom: 16}} id="google-id" label="Google ID"
                               variant="outlined"
                               value={google.id} onChange={handleGoogleID} disabled={!google.enabled}/>
                    <TextField style={{width: '100%'}} id="google-secret" label="Google Secret" variant="outlined"
                               value={google.secret} onChange={handleGoogleSecret} disabled={!google.enabled}/>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button onClick={() => handleCancel('google')} style={{marginRight: 16}}
                          color={'primary'}>Cancel</Button>
                  <Button variant="contained" color="primary" style={{alignSelf: 'flex-end'}}
                          onClick={() => handleSubmit('google', google)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </ExpansionPanelDetails>
          </ExpansionPanel>
        );

      case facebook:
        return (
          <ExpansionPanel
            expanded={expanded.includes('facebook')}
            onChange={() => openExpanded('facebook')}>
            <ExpansionPanelSummary
              id={'email'}>
              <Box display={'flex'} alignItems={'center'} flex={1}>
                <Typography variant={"subtitle2"} style={{flex: 1}}>
                  Facebook
                </Typography>
                <Typography variant={"subtitle2"} style={{flex: 1}}
                            className={data.facebook.enabled ? classes.green : classes.red}>
                  {data.facebook.enabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>
            </ExpansionPanelSummary>
            <ExpansionPanelDetails classes={{root: classes.details}}>
              <Box display={'flex'} flexDirection={'column'} justifyContent={'space-between'} alignItems={'center'}
                   width={'100%'}>
                <Box mb={4} display={'flex'} maxWidth={800} width={'100%'} flexDirection={'column'}
                     justifyContent={'flex-end'} alignItems={'center'}>
                  <FormControlLabel
                    style={{alignSelf: 'flex-end', marginBottom: 32}}
                    control={
                      <Switch
                        checked={facebook.enabled}
                        onChange={() => setFacebook({...facebook, enabled: !facebook.enabled})}
                        value={'facebook'}
                        color="primary"
                      />
                    }
                    label={facebook.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <Box width={'100%'}>
                    <TextField style={{width: '100%', marginBottom: 16}} id="facebook-id" label="Facebook ID"
                               variant="outlined"
                               value={facebook.id} onChange={handleFacebookID} disabled={!facebook.enabled}/>
                    <TextField style={{width: '100%'}} id="facebook-secret" label="Facebook Secret" variant="outlined"
                               value={facebook.secret} onChange={handleFacebookSecret} disabled={!facebook.enabled}/>
                  </Box>
                </Box>
                <Box alignSelf={'flex-end'}>
                  <Button onClick={() => handleCancel('facebook')} style={{marginRight: 16}}
                          color={'primary'}>Cancel</Button>
                  <Button variant="contained" color="primary" style={{alignSelf: 'flex-end'}}
                          onClick={() => handleSubmit('facebook', facebook)}>
                    Save
                  </Button>
                </Box>
              </Box>
            </ExpansionPanelDetails>
          </ExpansionPanel>
        );
      default:
        return
    }
  };

  return (
    <Box className={classes.root} {...rest}>
      <Box display={'flex'} alignItems={'center'} className={classes.titleContent} boxShadow={2}>
        <Typography variant={"subtitle2"} style={{width: '50%', paddingLeft: 24}}>Provider</Typography>
        <Typography variant={"subtitle2"} style={{width: '50%'}}>Status</Typography>
      </Box>
      {expansionPanelGenerator(email)}
      {expansionPanelGenerator(phone)}
      {expansionPanelGenerator(google)}
      {expansionPanelGenerator(facebook)}
    </Box>
  );
}

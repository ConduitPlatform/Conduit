import { Box, Container } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { Clear, MailOutline, Send } from '@material-ui/icons';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import { EmailTemplateType } from '../../models/emails/EmailModels';
import { useAppDispatch } from '../../redux/store';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import { isString } from 'lodash';
import { useForm, Controller } from 'react-hook-form';
import { IEmailState } from '../../models/emails/IEmailState';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';
import { FormInputDropdown } from '../common/RHFormComponents/RHFDropdown';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  simpleTextField: {
    width: '65ch',
  },
  typography: {
    marginBottom: theme.spacing(4),
  },
}));

interface Props {
  templates: EmailTemplateType[];
}

interface FormProps {
  _id: string;
  email: string;
  sender: string;
  subject: string;
  body: string;
  variables: string[];
  variablesValues: {};
  templateName: string;
}

const SendEmailForm: React.FC<Props> = ({ templates }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [withTemplate, setWithTemplate] = useState<boolean>(false);

  const methods = useForm<FormProps>({
    defaultValues: {
      _id: '',
      email: '',
      sender: '',
      subject: '',
      body: '',
      variables: [],
      variablesValues: {},
      templateName: '',
    },
  });

  const { handleSubmit, reset, control, getValues, setValue } = methods;

  const [emailState, setEmailState] = useState<IEmailState>({
    _id: '',
    email: '',
    sender: '',
    subject: '',
    body: '',
    variables: [],
    variablesValues: {},
    templateName: '',
  });

  const template = getValues('templateName');
  const variables = getValues('variables');
  const variablesValues = getValues('variablesValues');

  useEffect(() => {
    if (template !== '') {
      if (!isString(template)) return;
      const selectedTemplate = templates.find((template) => template._id === template);
      console.log(selectedTemplate);

      if (selectedTemplate !== undefined) {
        let variableValues = {};
        selectedTemplate.variables.forEach((variable: string) => {
          variableValues = { ...variableValues, [variable]: '' };
        });
        setValue('_id', selectedTemplate._id);
        setValue('variables', selectedTemplate.variables);
        setValue('body', selectedTemplate.name);
        setValue('variablesValues', variableValues);
        setValue('subject', selectedTemplate.subject);
      }
    }
  }, []);

  const onSubmit = (data: any) => {
    console.log(data);
    // dispatch(asyncSendEmail(email));
  };

  const handleVariableChange = (event: React.ChangeEvent<{ value: unknown }>, variable: string) => {
    if (!isString(event.target.value)) return;
    const newValue = event.target.value;
    const variableValues = { ...emailState.variablesValues, [variable]: newValue };
    setEmailState({ ...emailState, variablesValues: variableValues });
  };

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper} elevation={1}>
        <Typography variant={'h6'} className={classes.typography}>
          <MailOutline fontSize={'small'} />. Compose your email
        </Typography>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormInputText
                name="email"
                control={control}
                label="Recipient (To:)"
                required={'Name is required'}
                pattern={/^S*$/}
                errMsg={'No spaces allowed on template name'}
              />
            </Grid>
            <Grid item xs={12}>
              <FormInputText
                name="sender"
                control={control}
                label="Sender (From:)"
                required={'Name is required'}
                pattern={/^S*$/}
                errMsg={'No spaces allowed on template name'}
              />
            </Grid>
            <Grid item xs={8}>
              <FormInputText
                name="subject"
                control={control}
                label="Subject"
                required={'Name is required'}
                pattern={/^S*$/}
                errMsg={'No spaces allowed on template name'}
              />
            </Grid>
            <Grid item xs={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={withTemplate}
                    onChange={(e) => setWithTemplate(e.target.checked)}
                    name="withTemplate"
                    color="primary"
                  />
                }
                label="With Template"
              />
            </Grid>
            <Grid item xs={12}>
              <FormInputDropdown
                options={templates?.map((template) => ({
                  value: template._id,
                  label: template.name,
                }))}
                name="templateName"
                disabled={!withTemplate}
                control={control}
                label="Template name"
              />
            </Grid>
            <Grid item xs={12}>
              <FormInputText
                name="body"
                control={control}
                label="Email body"
                required={'Name is required'}
                pattern={/^S*$/}
                errMsg={'No spaces allowed on template name'}
              />
            </Grid>
            <Grid container item xs={12} spacing={1}>
              {variables.map((variable, index) => (
                <Grid key={variable + '_' + index} item xs={3}>
                  <TextField
                    label={variable}
                    variant="outlined"
                    required
                    fullWidth
                    value={emailState.variablesValues[variable]}
                    onChange={(event) => handleVariableChange(event, variable)}
                  />
                </Grid>
              ))}
            </Grid>
            <Grid item container justify="flex-end" xs={12}>
              <Box marginTop={3}>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<Clear />}
                  style={{ marginRight: 16 }}
                  onClick={() => reset()}>
                  Clear
                </Button>
                <Button variant="contained" color="primary" type="submit" startIcon={<Send />}>
                  Send
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default SendEmailForm;

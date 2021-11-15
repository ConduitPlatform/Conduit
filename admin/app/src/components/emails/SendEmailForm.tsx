import {
  Box,
  Container,
  TextField,
  Button,
  Grid,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { Clear, MailOutline, Send } from '@material-ui/icons';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { EmailTemplateType } from '../../models/emails/EmailModels';
import { useAppDispatch } from '../../redux/store';
import { isString } from 'lodash';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';
import { FormInputDropdown } from '../common/RHFormComponents/RHFDropdown';
import TemplateEditor from './TemplateEditor';
import { asyncSendEmail } from '../../redux/slices/emailsSlice';
import { FormCheckBox } from '../common/RHFormComponents/RHFCheckbox';

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
  checkBox: {
    marginTop: '5px',
  },
}));

interface Props {
  templates: EmailTemplateType[];
}

interface FormProps {
  email: string;
  sender: string;
  subject: string;
  body: string;
  templateName: string;
  withTemplate: boolean;
}
const SendEmailForm: React.FC<Props> = ({ templates }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [variables, setVariables] = useState<any>({});

  const methods = useForm<FormProps>({
    defaultValues: {
      email: '',
      sender: '',
      subject: '',
      templateName: '',
      body: '',
      withTemplate: false,
    },
  });
  const { handleSubmit, reset, control, setValue, getValues } = methods;

  const handleCancel = () => {
    setVariables({});

    reset();
  };

  const templateChanged = useWatch({
    control,
    name: 'templateName',
  });
  const watchWithTemplate = useWatch({
    control,
    name: 'withTemplate',
  });

  const selectedFormTemplate = getValues('templateName');

  const withTemplate = getValues('withTemplate');

  const onSubmit = (data: any) => {
    let email;
    if (selectedFormTemplate !== '') {
      email = {
        subject: data.subject,
        sender: data.sender,
        email: data.email,
        body: data.body,
        templateName: data.templateName,
        variables: variables,
      };
    } else {
      email = {
        subject: data.subject,
        sender: data.sender,
        email: data.email,
        body: data.body,
      };
    }
    dispatch(asyncSendEmail(email));
  };

  useEffect(() => {
    if (withTemplate) {
      if (!isString(selectedFormTemplate)) return;
      const selectedTemplate = templates.find((template) => template.name === selectedFormTemplate);

      if (!selectedTemplate) return;
      let variableValues = {};
      selectedTemplate.variables.forEach((variable: string) => {
        variableValues = { ...variables, [variable]: '' };
      });
      setValue('subject', selectedTemplate.subject);
      setValue('body', selectedTemplate.body);
      setVariables(variableValues);
    }
    if (!withTemplate) {
      setValue('subject', ''), setValue('body', ''), setValue('templateName', ''), setVariables({});
    }
  }, [templateChanged, watchWithTemplate]);

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper} elevation={1}>
        <Typography variant={'h6'} className={classes.typography}>
          <MailOutline fontSize={'small'} />. Compose your email
        </Typography>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormInputText name="email" label={'Recipient (To:)'} control={control} />
            </Grid>
            <Grid item xs={12}>
              <FormInputText name="sender" label={'Sender (From:)'} control={control} />
            </Grid>
            <Grid item xs={8}>
              <FormInputText
                name="subject"
                label={'Subject'}
                disabled={withTemplate}
                control={control}
              />
            </Grid>
            <Grid item xs={4} className={classes.checkBox}>
              <FormCheckBox
                setValue={setValue}
                control={control}
                name="withTemplate"
                label="With Template"
              />
            </Grid>
            <Grid item xs={8}>
              <FormInputDropdown
                disabled={!withTemplate}
                label={'Template name'}
                name="templateName"
                control={control}
                options={templates?.map((template) => ({
                  value: template.name,
                  label: template.name,
                }))}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="body"
                control={control}
                defaultValue=""
                render={({ field: { onChange, value }, fieldState: {} }) => (
                  <TemplateEditor
                    disabled={withTemplate ? true : false}
                    value={value}
                    setValue={onChange}
                  />
                )}
                rules={{ required: 'Template body required' }}
              />
            </Grid>
            <Grid container item xs={12} spacing={1}>
              {Object.entries(variables).map(([key, value], index: number) => (
                <Grid key={key + '_' + index} item xs={3}>
                  <TextField
                    label={key}
                    variant="outlined"
                    required
                    fullWidth
                    value={value}
                    onChange={(event) => {
                      setVariables({ ...variables, [key]: event.target.value });
                    }}
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
                  onClick={() => handleCancel()}>
                  Clear
                </Button>
                <Button variant="contained" color="primary" startIcon={<Send />} type="submit">
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

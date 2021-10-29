import {
  Button,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@material-ui/core';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import React, { useEffect, useState } from 'react';
import { CallMissedOutgoing } from '@material-ui/icons';
import { asyncGetExternalTemplates } from '../../redux/slices/emailsSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { EmailTemplateType } from '../../models/emails/EmailModels';
import { enqueueInfoNotification } from '../../utils/useNotifier';
import { camelCase } from 'lodash';

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: '30px',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '300px',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    width: '90%',
  },
  inputLabel: {
    width: '100%',
  },
  header: {
    textAlign: 'center',
    marginTop: '20px',
  },
  templateInfo: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(2),
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  textField: {
    width: '100%',
    marginTop: theme.spacing(2),
  },
}));

interface Props {
  handleSave: (templateState: EmailTemplateType) => void;
}

const ExternalTemplates: React.FC<Props> = ({ handleSave }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const emptyTemplate = {
    _id: '',
    name: '',
    subject: '',
    body: '',
    variables: [],
    externalManaged: false,
  };

  const { externalTemplates } = useAppSelector((state) => state.emailsSlice.data);
  const [select, setSelect] = useState<number>(-1);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType>(emptyTemplate);

  useEffect(() => {
    dispatch(asyncGetExternalTemplates());
  }, [dispatch]);

  const handleSaveData = () => {
    if (selectedTemplate.subject === '' || selectedTemplate.subject === undefined) {
      dispatch(enqueueInfoNotification('Please provide a valid subject', 'externalSubject'));
      return;
    }
    const data = {
      name: selectedTemplate.name,
      subject: selectedTemplate.subject,
      body: selectedTemplate.body,
      variables: selectedTemplate.variables,
      _id: selectedTemplate._id,
      externalManaged: true,
    };

    handleSave(data);
  };

  const handleTemplateChange = (e: any) => {
    setSelect(e.target.value);
    const foundTemplate = externalTemplates.find(
      (template: EmailTemplateType) => camelCase(template.name) === camelCase(e.target.value)
    );

    if (e.target.value !== '' && foundTemplate !== undefined)
      setSelectedTemplate({ ...foundTemplate, subject: '' });
    else setSelectedTemplate(emptyTemplate);
  };

  return (
    <Box className={classes.root}>
      <Grid container justify="center">
        <FormControl variant="outlined" className={classes.formControl}>
          <InputLabel>{select === -1 ? 'Select template' : 'Selected template'}</InputLabel>
          <Select label="Select your template" value={select} onChange={handleTemplateChange}>
            <MenuItem value={-1}>
              <em>None</em>
            </MenuItem>
            {externalTemplates.length > 0 &&
              externalTemplates.map((template, index: number) => (
                <MenuItem key={index} value={template._id}>
                  {template.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Grid>
      <Divider className={classes.divider} />
      {externalTemplates.length > 0 ? (
        <Typography className={classes.header}>
          {selectedTemplate.name === ''
            ? 'Select a template to proceed with the import'
            : 'Preview your imported template'}
        </Typography>
      ) : (
        <Typography className={classes.header}>No external templates at the moment</Typography>
      )}
      {selectedTemplate.name !== '' && (
        <Grid container spacing={2} justify="space-around" className={classes.templateInfo}>
          <Grid item xs={12}>
            <Typography variant="subtitle2">Template name:</Typography>
            <Typography variant="body2">{selectedTemplate.name}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2">Sender Input:</Typography>
            {selectedTemplate.sender === '' || selectedTemplate.sender === undefined ? (
              'No sender input provided'
            ) : (
              <Typography variant="body2">{selectedTemplate.sender}</Typography>
            )}
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2">Subject:</Typography>
            <TextField
              className={classes.textField}
              label={'Subject'}
              variant={'outlined'}
              value={selectedTemplate.subject}
              helperText="Provide a subject for the imported template."
              onChange={(event) => {
                setSelectedTemplate({
                  ...selectedTemplate,
                  subject: event.target.value,
                });
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body1">Body:</Typography>
            <Typography variant="h6">{selectedTemplate.body}</Typography>
          </Grid>
        </Grid>
      )}
      {selectedTemplate.name !== '' && (
        <Grid container xs={12} justify="space-around" style={{ marginTop: '15px' }}>
          <Grid>
            <Button
              variant="contained"
              color="primary"
              startIcon={<CallMissedOutgoing />}
              onClick={() => handleSaveData()}>
              Import template
            </Button>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ExternalTemplates;

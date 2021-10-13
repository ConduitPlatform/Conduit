import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Cancel, Save } from '@material-ui/icons';
import EditIcon from '@material-ui/icons/Edit';
import React, { useEffect, useState } from 'react';
import EmailDetails from './EmailDetails';
import { EmailTemplateType } from '../../models/emails/EmailModels';
import Image from 'next/dist/client/image';
import EmailImage from '../../assets/email.svg';
import { Button, Paper } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    flexGrow: 6,
    alignItems: 'center',
    justifyContent: 'center',
    justifyItems: 'center',
    justifySelf: 'center',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '300px',
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  grid: {
    marginBottom: theme.spacing(3),
  },
  multiline: {
    width: '100%',
    marginBottom: theme.spacing(3),
  },
  textField: {
    width: '100%',
  },
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(2),
  },
  marginTop: {
    marginTop: '60px',
  },
  centeredImg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionalSender: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
}));

interface Props {
  handleCreate: (templateState: EmailTemplateType) => void;
  handleSave: (templateState: EmailTemplateType) => void;
  template: EmailTemplateType;
  edit: any;
  setEdit: any;
  create: any;
  setCreate: any;
}

const TabPanel: React.FC<Props> = ({
  handleCreate,
  handleSave,
  template,
  edit,
  setEdit,
  create,
  setCreate,
}) => {
  const classes = useStyles();

  const [templateState, setTemplateState] = useState<EmailTemplateType>({
    _id: '',
    name: '',
    subject: '',
    body: '',
    variables: [],
  });

  useEffect(() => {
    setTemplateState({
      _id: template._id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });
  }, [template, edit]);

  const handleSaveClick = () => {
    if (create) {
      handleCreate(templateState);
    } else {
      handleSave(templateState);
    }
    setEdit(!edit);
  };

  const handleCancelClick = () => {
    if (create) {
      setTemplateState({ _id: '', name: '', subject: '', body: '', variables: [] });
      return;
    }
    setTemplateState({
      _id: template._id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });
  };

  return (
    <Container className={classes.marginTop}>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Grid container justify="space-around">
            {edit ? (
              <>
                <Grid item xs={6}>
                  <TextField
                    label={'Template name'}
                    variant={'outlined'}
                    value={templateState.name}
                    onChange={(event) => {
                      setTemplateState({
                        ...templateState,
                        name: event.target.value,
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={6} className={classes.optionalSender}>
                  <TextField
                    label={'*Optional sender input'}
                    variant={'outlined'}
                    value={templateState.name}
                    onChange={(event) => {
                      setTemplateState({
                        ...templateState,
                        name: event.target.value,
                      });
                    }}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Template name:</Typography>
                  <Typography variant="h6">{templateState.name}</Typography>
                </Grid>
                <Grid item xs={6} className={classes.optionalSender}>
                  <Typography variant="subtitle2">Sender Input:</Typography>
                  <Typography variant="h6">{templateState.name}</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
        <Divider className={classes.divider} />
        <EmailDetails
          edit={edit}
          templateState={templateState}
          setTemplateState={setTemplateState}
        />

        <Grid container item xs={12} justify="space-around" style={{ marginTop: '15px' }}>
          {!edit ? (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEdit(true)}>
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Cancel />}
                onClick={handleCancelClick}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Save />}
                onClick={handleSaveClick}>
                Save
              </Button>
            </>
          )}
        </Grid>
        {!edit && (
          <div className={classes.centeredImg}>
            <Image src={EmailImage} width="200px" alt="mail" />
          </div>
        )}
      </Box>
    </Container>
  );
};

export default TabPanel;

import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import React from 'react';
import { EmailTemplateType } from '../../models/emails/EmailModels';
import TemplateEditor from './TemplateEditor';

const useStyles = makeStyles((theme) => ({
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
    backgroundColor: theme.palette.background.default,
  },
  chip: {
    margin: theme.spacing(1),
    color: theme.palette.secondary.main,
  },
}));

interface Props {
  edit: boolean;
  templateState: EmailTemplateType;
  setTemplateState: (values: EmailTemplateType) => void;
}

const EmailDetails: React.FC<Props> = ({ edit, templateState, setTemplateState }) => {
  const classes = useStyles();

  return (
    <Box>
      <Grid container className={classes.grid}>
        <Grid item xs={12}>
          {edit ? (
            <TextField
              label={'Subject'}
              variant="outlined"
              className={classes.textField}
              value={templateState.subject}
              onChange={(event) => {
                setTemplateState({ ...templateState, subject: event.target.value });
              }}
            />
          ) : (
            <>
              <Typography variant="body1">Subject</Typography>
              <Typography variant="subtitle2">{templateState.subject}</Typography>
            </>
          )}
        </Grid>
      </Grid>
      {edit ? (
        <TemplateEditor
          value={templateState.body}
          setValue={(value) => {
            setTemplateState({
              ...templateState,
              body: value,
            });
          }}
        />
      ) : (
        <>
          <Typography variant="body1">Body</Typography>
          <Typography variant="subtitle2" style={{ whiteSpace: 'pre-line' }}>
            {templateState.body}
          </Typography>
        </>
      )}
    </Box>
  );
};

export default EmailDetails;

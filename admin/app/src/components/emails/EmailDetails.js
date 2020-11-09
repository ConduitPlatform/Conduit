import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Add } from '@material-ui/icons';
import React, { useState } from 'react';

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
  },
  chip: {
    margin: theme.spacing(1),
  },
}));

const EmailDetails = ({ edit, add, templateState, setAdd, setTemplateState }) => {
  const classes = useStyles();

  const [variable, setVariable] = useState('');

  const handleChipClick = () => {
    setAdd(!add);
  };

  const handleKeys = (event) => {
    if (event.keyCode === 13) {
      const newVariables = [...templateState.variables, variable];
      setAdd(false);
      setTemplateState({
        ...templateState,
        variables: newVariables,
      });
      setVariable('');
    }
    if (event.keyCode === 27) {
      setVariable('');
      setAdd(false);
    }
  };

  const handleVariableDelete = (index) => {
    const newVariables = templateState.variables;
    newVariables.splice(index, 1);
    setTemplateState({
      ...templateState,
      variables: newVariables,
    });
  };

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
        <TextField
          className={classes.multiline}
          id="filled-textarea"
          label="Body"
          multiline
          rows={8}
          variant="outlined"
          value={templateState.body}
          onChange={(event) => {
            setTemplateState({
              ...templateState,
              body: event.target.value,
            });
          }}
          InputProps={{
            readOnly: !edit,
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

      <Divider className={classes.divider} />

      <Grid container className={classes.grid}>
        <Grid item xs={12}>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'overline'}>Declared variables</Typography>
          </Box>
          <Box>
            {templateState.variables.map((v, index) =>
              edit ? (
                <Chip
                  className={classes.chip}
                  key={index}
                  label={v}
                  onDelete={() => {
                    handleVariableDelete(index);
                  }}
                />
              ) : (
                <Chip className={classes.chip} key={`chip-${index}`} label={v} />
              )
            )}
            {edit && !add && (
              <Chip
                label="Add"
                clickable
                onClick={handleChipClick}
                icon={<Add />}
                variant="outlined"
              />
            )}
            {add && add && (
              <TextField
                helperText={'Enter: to save | Esc: to cancel'}
                size={'small'}
                variant={'outlined'}
                label={'New variable'}
                onKeyDown={handleKeys}
                value={variable}
                onChange={(event) => {
                  setVariable(event.target.value);
                }}
              />
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmailDetails;

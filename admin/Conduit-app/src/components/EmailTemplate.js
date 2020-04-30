import Container from '@material-ui/core/Container';
import React, { useEffect, useState } from 'react';
import Tabs from '@material-ui/core/Tabs';
import { makeStyles } from '@material-ui/core/styles';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import { Add, AddCircleOutline, Cancel, Save } from '@material-ui/icons';
import Paper from '@material-ui/core/Paper';
import Chip from '@material-ui/core/Chip';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
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
  chip: {
    margin: theme.spacing(1),
  },
}));

const TabPanel = ({ handleCreate, handleSave, template, value, index }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const [variable, setVariable] = useState('');
  const [templateState, setTemplateState] = useState({ _id: '', name: '', subject: '', body: '', variables: [] });

  const handleEditClick = () => {
    setEdit(!edit);
  };
  const handleSaveClick = () => {
    if (templateState._id === 'newTemplate_id') {
      handleCreate(templateState);
    } else {
      handleSave(templateState);
    }
    setEdit(!edit);
  };
  const handleCancelClick = () => {
    setEdit(false);
    setAdd(false);
    setTemplateState({
      ...templateState,
      _id: template._id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });
  };
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

  useEffect(() => {
    setTemplateState({
      ...templateState,
      _id: template._id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
    });

    if (template._id === 'newTemplate_id') {
      setEdit(true);
    }
  }, [template]);

  if (value !== index) {
    return null;
  }

  const renderDetails = () => {
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
            <Box width={'100%'} display={'inline-flex'} justifyContent={'space-between'} alignItems={'center'}>
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
              {edit && !add && <Chip label="Add" clickable onClick={handleChipClick} icon={<Add />} variant="outlined" />}
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

  return (
    <Container>
      <Box>
        <Grid container>
          <Grid item xs={10}>
            {edit ? (
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
            ) : (
              <Typography variant="h6">{templateState.name}</Typography>
            )}
            {/*<Typography variant="body2">{description}</Typography>*/}
          </Grid>
          <Grid container item xs={2} justify={'flex-end'}>
            {!edit ? (
              <IconButton aria-label="edit" onClick={handleEditClick}>
                <EditIcon />
              </IconButton>
            ) : (
              <>
                <IconButton aria-label="cancel" onClick={handleCancelClick}>
                  <Cancel />
                </IconButton>
                <IconButton aria-label="save" onClick={handleSaveClick}>
                  <Save />
                </IconButton>
              </>
            )}
          </Grid>
        </Grid>
        <Divider className={classes.divider} />
        {renderDetails()}
      </Box>
    </Container>
  );
};

const EmailTemplate = ({ templatesData, error, handleSave, handleCreate }) => {
  const classes = useStyles();
  const [value, setValue] = useState(0);
  const [templatesState, setTemplatesState] = useState([]);

  useEffect(() => {
    if (!templatesData) {
      return;
    }
    setTemplatesState(templatesData);
  }, [templatesData, error]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const saveTemplateChanges = (data) => {
    handleSave(data);
  };

  const createNewTemplate = (data) => {
    handleCreate(data);
  };

  const newTemplate = () => {
    const newTemplate = {
      _id: 'newTemplate_id',
      name: 'New Template',
      subject: '',
      body: '',
      variables: [],
    };
    setTemplatesState([...templatesState, newTemplate]);
    setValue(templatesState.length);
  };

  return (
    <Container>
      <Grid container item xs={12} justify={'flex-end'}>
        <Button
          variant="contained"
          color="primary"
          className={classes.button}
          startIcon={<AddCircleOutline />}
          onClick={() => newTemplate()}>
          New Template
        </Button>
      </Grid>
      <Paper className={classes.paper}>
        <Box className={classes.root}>
          <Tabs
            orientation="vertical"
            variant="scrollable"
            value={value}
            onChange={handleChange}
            aria-label="Vertical tabs"
            className={classes.tabs}>
            {templatesState.map((t) => (
              <Tab key={t._id} label={t.name} />
            ))}
          </Tabs>
          {templatesState.map((t, index) => (
            <TabPanel
              key={t._id}
              value={value}
              index={index}
              description={'description needed'}
              template={t}
              handleSave={saveTemplateChanges}
              handleCreate={createNewTemplate}>
              {t.name}
            </TabPanel>
          ))}
        </Box>
      </Paper>
    </Container>
  );
};

export default EmailTemplate;

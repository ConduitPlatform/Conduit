import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Add, Cancel, Save } from '@material-ui/icons';
import EditIcon from '@material-ui/icons/Edit';
import React, { useEffect, useState } from 'react';
import Image from 'next/dist/client/image';
import FormsImage from '../../assets/svgs/forms.svg';
import {
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
} from '@material-ui/core';
import { v4 as uuidV4 } from 'uuid';
import { FormsModel } from '../../models/forms/FormsModels';
import Delete from '@material-ui/icons/Delete';

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
  fields: {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    alignItems: 'center',
  },
}));

interface Props {
  handleCreate: (templateState: FormsModel) => void;
  handleSave: (templateState: FormsModel) => void;
  form: FormsModel;
  edit: boolean;
  setEdit: (value: boolean) => void;
  create: boolean;
  setCreate: (value: boolean) => void;
}

const ViewEditForm: React.FC<Props> = ({
  handleCreate,
  handleSave,
  form,
  edit,
  setEdit,
  create,
  setCreate,
}) => {
  const classes = useStyles();

  const [formState, setFormState] = useState<FormsModel>({
    _id: '',
    name: '',
    fields: {},
    forwardTo: '',
    emailField: '',
    enabled: false,
  });

  const [inputFields, setInputFields] = useState([{ id: uuidV4(), key: '', type: '' }]);

  console.log(formState);

  const handleAddField = () => {
    setInputFields([...inputFields, { id: uuidV4(), key: '', type: '' }]);
  };

  const handleFieldsChange = (id: string) => (evt) => {
    const { value } = evt.target;
    setInputFields((list) =>
      list.map((el) =>
        el.id === id
          ? {
              ...el,
              [evt.target.name]: value,
            }
          : el
      )
    );
  };

  const handleRemoveField = (id: string) => {
    setInputFields((list) => list.filter((el) => el.id !== id));
  };

  useEffect(() => {
    if (!create)
      setFormState({
        _id: form._id,
        name: form.name,
        fields: form.fields,
        forwardTo: form.forwardTo,
        emailField: form.emailField,
        enabled: form.enabled,
      });
    const fieldsToDisplay: [] = [];
    Object.entries(form.fields).forEach(([key, value]) => {
      fieldsToDisplay.push({ id: uuidV4(), key: key, type: value });
    });
    setInputFields(fieldsToDisplay);
  }, [form, edit, create]);

  const handleSaveClick = () => {
    const fields = {};
    inputFields.forEach((item) => {
      if (item.key !== '' && item.type !== '') fields[item.key] = item.type;
    });

    if (create) {
      delete formState._id;
      handleCreate({ ...formState, fields: fields });
    } else {
      handleSave({ ...formState, fields: fields });
    }
    setCreate(false);
    setEdit(!edit);
  };

  const handleCancelClick = () => {
    if (create) {
      setFormState({
        _id: '',
        name: '',
        fields: {},
        forwardTo: '',
        emailField: '',
        enabled: false,
      });
      setInputFields([{ id: uuidV4(), key: '', type: '' }]);
      return;
    }
    setFormState({
      _id: form._id,
      name: form.name,
      fields: form.fields,
      forwardTo: form.forwardTo,
      emailField: form.emailField,
      enabled: form.enabled,
    });
    const fieldsToDisplay: [] = [];
    Object.entries(form.fields).forEach(([key, value]) => {
      fieldsToDisplay.push({ id: uuidV4(), key: key, type: value });
    });
    setInputFields(fieldsToDisplay);
  };

  return (
    <Container className={classes.marginTop}>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Grid container spacing={2}>
            {edit ? (
              <>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Form name'}
                    variant={'outlined'}
                    value={formState.name}
                    onChange={(event) => {
                      setFormState({
                        ...formState,
                        name: event.target.value,
                      });
                    }}
                  />
                  <Divider className={classes.divider} />
                </Grid>
                <Grid item container xs={12}>
                  <Grid item xs={11}>
                    <Typography variant="subtitle2">Form fields:</Typography>
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton
                      color="primary"
                      size="small"
                      aria-label="add"
                      onClick={handleAddField}>
                      <Add />
                    </IconButton>
                  </Grid>
                </Grid>
                {inputFields.map((x, index: number) => {
                  return (
                    <Grid key={index} className={classes.fields} container spacing={3}>
                      <Grid item xs={5}>
                        <TextField
                          name="key"
                          label="Key"
                          variant="outlined"
                          value={x.key}
                          onChange={handleFieldsChange(x.id)}
                        />
                      </Grid>
                      <Grid item xs={5}>
                        <FormControl style={{ minWidth: 200 }}>
                          <Select
                            variant="outlined"
                            value={x.type}
                            onChange={handleFieldsChange(x.id)}
                            name="type">
                            <MenuItem value={'String'}>String</MenuItem>
                            <MenuItem value={'File'}>File</MenuItem>
                            <MenuItem value={'Date'}>Date</MenuItem>
                            <MenuItem value={'Number'}>Number</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={2}>
                        <IconButton
                          color="primary"
                          size="small"
                          aria-label="delete"
                          onClick={() => handleRemoveField(x.id)}>
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>
                  );
                })}

                <Grid item xs={12}>
                  <Divider className={classes.divider} />
                  <TextField
                    className={classes.textField}
                    label={'Forward to'}
                    variant={'outlined'}
                    value={formState.forwardTo}
                    onChange={(event) => {
                      setFormState({
                        ...formState,
                        forwardTo: event.target.value,
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    className={classes.textField}
                    label={'Email Field'}
                    variant={'outlined'}
                    value={formState.emailField}
                    onChange={(event) => {
                      setFormState({
                        ...formState,
                        emailField: event.target.value,
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'h6'}>Enable form</Typography>
                    <FormControlLabel
                      label={''}
                      control={
                        <Switch
                          disabled={!edit}
                          checked={formState.enabled}
                          onChange={() => {
                            setFormState({
                              ...formState,
                              enabled: !formState.enabled,
                            });
                          }}
                          value={'useAttachments'}
                          color="primary"
                        />
                      }
                    />
                  </Box>
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Form name:</Typography>
                  <Typography variant="h6">{formState.name}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Template name:</Typography>
                  <Typography variant="h6">{formState._id}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Fields:</Typography>
                  <Typography variant="h6">Fields</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Forward To:</Typography>
                  <Typography variant="h6">{formState.forwardTo}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Email Field:</Typography>
                  <Typography variant="h6">{formState.emailField}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Enabled:</Typography>
                  <Typography variant="h6">{formState.enabled ? 'true' : 'false'}</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>

        <Grid container item xs={12} justify="space-around" style={{ marginTop: '15px' }}>
          {!edit ? (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<EditIcon />}
              onClick={() => setEdit(true)}>
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
            <Image src={FormsImage} width="200px" alt="mail" />
          </div>
        )}
      </Box>
    </Container>
  );
};

export default ViewEditForm;

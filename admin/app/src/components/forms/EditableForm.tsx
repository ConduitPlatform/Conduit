import React, { FC, useEffect, useState } from 'react';
import sharedClasses from '../common/sharedClasses';
import { useForm } from 'react-hook-form';
import {
  Button,
  Container,
  FormControl,
  Grid,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { Add, Delete } from '@material-ui/icons';
import { v4 as uuidV4 } from 'uuid';
import { useAppDispatch } from '../../redux/store';
import { enqueueInfoNotification } from '../../utils/useNotifier';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';

interface PropsForInputFields {
  id: string;
  key: string;
  type: string;
}

interface Props {
  preloadedValues: any;
  handleSubmitData: (data: any) => void;
}

interface IForm {
  name: string;
  forwardTo: string;
  emailField: string;
}

const EditableForm: FC<Props> = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();
  const dispatch = useAppDispatch();
  const [inputFields, setInputFields] = useState([{ id: uuidV4(), key: '', type: '' }]);
  console.log('test');

  const methods = useForm<IForm>({ defaultValues: preloadedValues });

  const { handleSubmit, reset, control } = methods;

  const handleAddField = () => {
    setInputFields([...inputFields, { id: uuidV4(), key: '', type: '' }]);
  };

  useEffect(() => {
    const fieldsToDisplay: PropsForInputFields[] = [];
    Object.entries(preloadedValues.fields).forEach(([key, value]) => {
      fieldsToDisplay.push({ id: uuidV4(), key: key, type: value as string });
    });
    setInputFields(fieldsToDisplay);
  }, [preloadedValues]);

  const handleCancel = () => {
    const fieldsToDisplay: PropsForInputFields[] = [];
    Object.entries(preloadedValues.fields).forEach(([key, value]) => {
      fieldsToDisplay.push({ id: uuidV4(), key: key, type: value as string });
    });
    setInputFields(fieldsToDisplay);
    reset();
  };

  const onSubmit = (data: any) => {
    const fields: { [key: string]: string } = {};
    inputFields.forEach((item) => {
      if (item.key !== '' && item.type !== '') fields[item.key] = item.type;
    });

    handleSubmitData({ ...data, fields: fields });
  };

  const handleFieldsChange = (id: string) => (evt: React.ChangeEvent<any>) => {
    const { value } = evt.target;

    const regex = /[^a-z0-9_]/gi;
    if (regex.test(value)) {
      dispatch(
        enqueueInfoNotification(
          'The form name can only contain alpharithmetics and _',
          'infoDuplicate'
        )
      );
    }

    setInputFields((list) =>
      list.map((el) =>
        el.id === id
          ? {
              ...el,
              [evt.target.name]: value.replace(/[^a-z0-9_]/gi, ''),
            }
          : el
      )
    );
  };

  const handleRemoveField = (id: string) => {
    setInputFields((list) => list.filter((el) => el.id !== id));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{}}>
      <Container className={classes.root} maxWidth="xl">
        <Grid container alignItems="center" className={classes.root} spacing={2}>
          <Grid item sm={12}>
            <FormInputText
              name="name"
              control={control}
              label="Name"
              required={'The form name is required'}
              pattern={/^\S*$/}
              errMsg={'The form cannot contain whitespaces'}
            />
          </Grid>
          <Grid item container xs={12}>
            <Grid item xs={11}>
              <Typography variant="subtitle2">Form fields:</Typography>
            </Grid>
            <Grid item xs={1}>
              <IconButton color="primary" size="small" aria-label="add" onClick={handleAddField}>
                <Add />
              </IconButton>
            </Grid>
          </Grid>
          <Grid item sm={12}>
            {inputFields.map((x, index: number) => {
              return (
                <Grid key={index} container spacing={2}>
                  <Grid item xs={5} className={classes.fields}>
                    <TextField
                      name="key"
                      label="Key"
                      variant="outlined"
                      value={x.key}
                      onChange={handleFieldsChange(x.id)}
                    />
                  </Grid>
                  <Grid item xs={5} className={classes.fields}>
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
                  <Grid item xs={2} className={classes.fields}>
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
          </Grid>
          <Grid item sm={12}>
            <FormInputText name="forwardTo" control={control} label="Forward to" />
          </Grid>
          <Grid item sm={12}>
            <FormInputText
              name="emailField"
              control={control}
              label="Email field"
              typeOfInput={'email'}
            />
          </Grid>
          <Grid container item xs={12} justify="space-around" style={{ marginTop: '35px' }}>
            <Grid item>
              <Button type="submit" variant="contained" color="primary" size="large">
                Save
              </Button>
            </Grid>
            <Grid item>
              <Button
                onClick={() => handleCancel()}
                variant="contained"
                color="primary"
                size="large">
                Cancel
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </form>
  );
};

export default EditableForm;

import React, { FC, useEffect, useState } from 'react';
import sharedClasses from '../common/sharedClasses';
import { FormProvider, useForm } from 'react-hook-form';
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
import { FormInputText } from '../common/FormComponents/FormInputText';
import { FormsModel } from '../../models/forms/FormsModels';
import { FormInputSwitch } from '../common/FormComponents/FormInputSwitch';

interface PropsForInputFields {
  id: string;
  key: string;
  type: string;
}

interface Props {
  preloadedValues: FormsModel;
  handleSubmitData: (data: FormsModel) => void;
}

interface IForm {
  name: string;
  forwardTo: string;
  emailField: string;
  enabled: boolean;
}

const EditableForm: FC<Props> = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();
  const dispatch = useAppDispatch();
  const [inputFields, setInputFields] = useState<{ id: string; key: string; type: string }[]>([
    { id: uuidV4(), key: '', type: '' },
  ]);

  const methods = useForm<IForm>({ defaultValues: preloadedValues });

  const { reset } = methods;

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

  const onCancel = () => {
    const fieldsToDisplay: PropsForInputFields[] = [];
    Object.entries(preloadedValues.fields).forEach(([key, value]) => {
      fieldsToDisplay.push({ id: uuidV4(), key: key, type: value as string });
    });
    setInputFields(fieldsToDisplay);
    reset();
  };

  const onSubmit = (data: IForm) => {
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
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Grid container spacing={2}>
          <Grid item sm={12}>
            <FormInputText
              name="name"
              label="Name"
              rules={{
                required: 'The form name is required',
                pattern: { value: /^S+$/, message: 'A form name should not have spaces' },
              }}
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
            {inputFields.map((inputField, index: number) => {
              return (
                <Grid key={index} container spacing={2}>
                  <Grid item xs={5} className={classes.fields}>
                    <TextField
                      name="key"
                      label="Key"
                      variant="outlined"
                      value={inputField.key}
                      onChange={handleFieldsChange(inputField.id)}
                    />
                  </Grid>
                  <Grid item xs={5} className={classes.fields}>
                    <FormControl className={classes.formFields}>
                      <Select
                        variant="outlined"
                        value={inputField.type}
                        onChange={handleFieldsChange(inputField.id)}
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
                      onClick={() => handleRemoveField(inputField.id)}>
                      <Delete />
                    </IconButton>
                  </Grid>
                </Grid>
              );
            })}
          </Grid>
          <Grid item sm={12}>
            <FormInputText name="forwardTo" label="Forward to" />
          </Grid>
          <Grid item sm={12}>
            <FormInputText name="emailField" label="Email field" typeOfInput={'email'} />
          </Grid>
          <Grid item container xs={12}>
            <Grid item xs={11}>
              <Typography variant="subtitle2">Enabled form:</Typography>
            </Grid>
            <Grid item xs={1}>
              <FormInputSwitch name="enabled" />
            </Grid>
          </Grid>
          <Grid container item>
            <Grid item className={classes.marginRight}>
              <Button variant="outlined" onClick={() => onCancel()}>
                Cancel
              </Button>
            </Grid>
            <Grid item>
              <Button variant="contained" color="primary" type="submit">
                Save
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </form>
    </FormProvider>
  );
};

export default EditableForm;

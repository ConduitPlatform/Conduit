import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import React, { useEffect, useState } from 'react';
import slugify from '../../../../utils/slugify';

const useStyles = makeStyles((theme) => ({
  textField: {
    marginBottom: theme.spacing(1),
  },
  info: {
    width: '100%',
    fontSize: 14,
    marginBottom: theme.spacing(3),
    opacity: '0.5',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    padding: theme.spacing(2),
  },
}));

export default function BooleanForm({
  drawerData,
  readOnly,
  onSubmit,
  onClose,
  selectedItem,
  ...rest
}) {
  const classes = useStyles();

  const [booleanData, setBooleanData] = useState({
    name: selectedItem ? selectedItem.name : '',
    placeholderFalse: selectedItem ? selectedItem.placeholderFalse : '',
    placeholderTrue: selectedItem ? selectedItem.placeholderTrue : '',
    type: selectedItem ? selectedItem.type : '',
    default: selectedItem ? selectedItem.default : false,
    unique: selectedItem ? selectedItem.unique : false,
    select: selectedItem ? selectedItem.select : true,
    required: selectedItem ? selectedItem.required : false,
    isArray: selectedItem ? selectedItem.isArray : false,
  });

  useEffect(() => {
    const slug = slugify(booleanData.name);
    setBooleanData({ ...booleanData, id: slug });
  }, [booleanData, booleanData.name]);

  const handleFieldName = (event) => {
    setBooleanData({ ...booleanData, name: event.target.value });
  };

  const handleFalsePlaceholder = (event) => {
    setBooleanData({ ...booleanData, placeholderFalse: event.target.value });
  };

  const handleTruePlaceholder = (event) => {
    setBooleanData({ ...booleanData, placeholderTrue: event.target.value });
  };

  const handleFieldDefault = () => {
    setBooleanData({ ...booleanData, default: !booleanData.default });
  };

  const handleFieldUnique = () => {
    setBooleanData({ ...booleanData, unique: !booleanData.unique });
  };

  const handleFieldRequired = () => {
    setBooleanData({ ...booleanData, required: !booleanData.required });
  };

  const handleFieldSelect = () => {
    setBooleanData({ ...booleanData, select: !booleanData.select });
  };

  const handleFieldIsArray = () => {
    setBooleanData({ ...booleanData, isArray: !booleanData.isArray });
  };

  const handleSubmit = (event) => {
    onSubmit(event, booleanData);
    event.preventDefault();
  };

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className={classes.form} {...rest}>
      <TextField
        id="Field Name"
        label="Field Name"
        onChange={handleFieldName}
        value={booleanData.name}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
        InputProps={{
          readOnly: readOnly && !selectedItem,
        }}
        helperText={'This is the name of the field in the schema model'}
      />
      <TextField
        id="False Placeholder"
        label="False Placeholder"
        onChange={handleFalsePlaceholder}
        placeholder={'false'}
        value={booleanData.placeholderFalse}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
        helperText={'Placeholder to appear in the editor'}
      />
      <TextField
        id="True Placeholder"
        label="True Placeholder"
        onChange={handleTruePlaceholder}
        placeholder={'true'}
        value={booleanData.placeholderTrue}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
        helperText={'Placeholder to appear in the editor'}
      />
      <Box width={'100%'}>
        <Grid container>
          <Grid item xs={12}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Default Value
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={booleanData.default}
                    onChange={handleFieldDefault}
                    color="primary"
                  />
                }
                label={booleanData.default ? 'True' : 'False'}
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant={'subtitle1'} className={classes.info}>
              The default value of the field
            </Typography>
          </Grid>
        </Grid>

        <Grid container>
          <Grid item xs={12}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Unique field
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={booleanData.unique}
                    onChange={handleFieldUnique}
                    color="primary"
                  />
                }
                label=""
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant={'subtitle1'} className={classes.info}>
              If active, this field's value must be unique
            </Typography>
          </Grid>
        </Grid>

        <Grid container>
          <Grid item xs={12}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Required
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={booleanData.required}
                    onChange={handleFieldRequired}
                    color="primary"
                  />
                }
                label=""
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant={'body2'} className={classes.info}>
              If active, this field will be required
            </Typography>
          </Grid>
        </Grid>

        <Grid container>
          <Grid item xs={12}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Select
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={booleanData.select}
                    onChange={handleFieldSelect}
                    color="primary"
                  />
                }
                label=""
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant={'body2'} className={classes.info}>
              This option defines if the field you be returned from the database
            </Typography>
          </Grid>
        </Grid>

        <Grid container>
          <Grid item xs={12}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Array
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={booleanData.isArray}
                    onChange={handleFieldIsArray}
                    color="primary"
                  />
                }
                label=""
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant={'body2'} className={classes.info}>
              Activate this option if you want your field to be of type Array
            </Typography>
          </Grid>
        </Grid>
      </Box>
      <Box display={'flex'} width={'100%'}>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          style={{ marginRight: 16 }}>
          OK
        </Button>
        <Button variant="contained" onClick={onClose}>
          CANCEL
        </Button>
      </Box>
    </form>
  );
}

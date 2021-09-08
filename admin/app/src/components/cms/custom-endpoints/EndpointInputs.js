import React, { Fragment } from 'react';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import InputLocationEnum from '../../../models/InputLocationEnum';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';

const EndpointInputs = ({
  editMode,
  selectedInputs,
  setSelectedInputs,
  handleRemoveInput,
}) => {
  const handleInputNameChange = (event, index) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.name = value;
      setSelectedInputs(currentInputs);
    }
  };

  const handleInputTypeChange = (event, index) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.type = value;
      setSelectedInputs(currentInputs);
    }
  };
  const handleInputLocationChange = (event, index) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.location = Number(value);
      setSelectedInputs(currentInputs);
    }
  };

  const handleInputIsArray = (event, index) => {
    const value = event.target.checked;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.array = value;
      setSelectedInputs(currentInputs);
    }
  };

  const handleInputIsOptional = (event, index) => {
    const value = event.target.checked;
    const currentInputs = selectedInputs.slice();
    const input = currentInputs[index];
    if (input) {
      input.optional = value;
      setSelectedInputs(currentInputs);
    }
  };
  return selectedInputs.map((input, index) => (
    <Fragment key={`input-${index}`}>
      <Grid item xs={1} key={index}>
        <Typography>{index + 1}.</Typography>
      </Grid>
      <Grid item xs={3}>
        <TextField
          placeholder={'Input name'}
          fullWidth
          disabled={!editMode}
          value={input.name}
          onChange={(event) => handleInputNameChange(event, index)}
        />
      </Grid>
      <Grid item xs={2}>
        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            disabled={!editMode}
            native
            value={input.type}
            onChange={(event) => handleInputTypeChange(event, index)}>
            <option aria-label="None" value="" />
            <option value={'String'}>String</option>
            <option value={'Number'}>Number</option>
            <option value={'Boolean'}>Boolean</option>
            <option value={'ObjectId'}>ObjectId</option>
            <option value={'Date'}>Date</option>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={2}>
        <FormControl fullWidth>
          <InputLabel>Location</InputLabel>
          <Select
            disabled={!editMode}
            native
            value={input.location}
            onChange={(event) => handleInputLocationChange(event, index)}>
            <option aria-label="None" value="" />
            <option value={InputLocationEnum.QUERY_PARAMS}>Query params</option>
            <option value={InputLocationEnum.BODY}>Body</option>
            <option value={InputLocationEnum.URL_PARAMS}>URL</option>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={1} />
      <Grid container item xs={2}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                color={'primary'}
                checked={input.array}
                onChange={(event) => handleInputIsArray(event, index)}
                name="Array"
                size={'small'}
                disabled={!editMode}
              />
            }
            label="Array"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                color={'primary'}
                checked={input.optional}
                onChange={(event) => handleInputIsOptional(event, index)}
                name="Optional"
                size={'small'}
                disabled={!editMode}
              />
            }
            label="Optional"
          />
        </Grid>
      </Grid>
      <Grid item xs={1}>
        <IconButton
          disabled={!editMode}
          size="small"
          onClick={() => handleRemoveInput(index)}>
          <RemoveCircleOutlineIcon />
        </IconButton>
      </Grid>
    </Fragment>
  ));
};

export default EndpointInputs;

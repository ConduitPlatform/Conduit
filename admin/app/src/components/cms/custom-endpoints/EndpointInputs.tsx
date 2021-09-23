import React, { FC, Fragment } from 'react';
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
import { Input } from '../../../models/customEndpoints/customEndpointsModels';

interface Props {
  editMode: boolean;
  selectedInputs: any;
  setSelectedInputs: (inputs: any) => void;
  handleRemoveInput: (index: number) => void;
}

const EndpointInputs: FC<Props> = ({
  editMode,
  selectedInputs,
  setSelectedInputs,
  handleRemoveInput,
}) => {
  const handleInputNameChange = (
    event: React.ChangeEvent<{ value: any }>,
    index: number
  ) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = { ...currentInputs[index] };

    if (input) {
      input.name = value;
      currentInputs[index] = input;
      setSelectedInputs(currentInputs);
    }
  };

  const handleInputTypeChange = (
    event: React.ChangeEvent<{ value: any }>,
    index: number
  ) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = { ...currentInputs[index] };

    if (input) {
      input.type = value;
      currentInputs[index] = input;
      setSelectedInputs(currentInputs);
    }
  };
  const handleInputLocationChange = (
    event: React.ChangeEvent<{ value: any }>,
    index: number
  ) => {
    const value = event.target.value;
    const currentInputs = selectedInputs.slice();
    const input = { ...currentInputs[index] };
    if (input) {
      input.location = Number(value);
      currentInputs[index] = input;
      setSelectedInputs(currentInputs);
    }
  };

  const handleInputIsArray = (
    event: React.ChangeEvent<{ checked: boolean }>,
    index: number
  ) => {
    const value = event.target.checked;
    const currentInputs = selectedInputs.slice();
    const input = { ...currentInputs[index] };
    if (input) {
      input.array = value;
      currentInputs[index] = input;
      setSelectedInputs(currentInputs);
    }
  };

  console.log(selectedInputs);

  const handleInputIsOptional = (
    event: React.ChangeEvent<{ checked: any }>,
    index: number
  ) => {
    const value = event.target.checked;
    const currentInputs = selectedInputs.slice();
    const input = { ...currentInputs[index] };
    if (input) {
      input.optional = value;
      currentInputs[index] = input;
      setSelectedInputs(currentInputs);
    }
  };
  return selectedInputs.map((input: Input, index: number) => (
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

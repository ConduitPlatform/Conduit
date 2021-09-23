import React, { FC, useState } from 'react';
import Box from '@material-ui/core/Box';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';

const SelectType: FC = ({ item, ...rest }) => {
  const [select, setSelect] = useState('');

  const handleChange = (event) => {
    setSelect(event.target.value);
  };

  return (
    <Box {...rest}>
      <FormControl style={{ width: 'fit-content' }}>
        <Select
          labelId="select-type"
          id="select-type"
          value={select}
          onChange={handleChange}
          displayEmpty
          MenuProps={{
            getContentAnchorEl: null,
            anchorOrigin: {
              vertical: 'bottom',
              horizontal: 'left',
            },
          }}>
          <MenuItem value="" disabled>
            {item.placeholder}
          </MenuItem>
          {item.menuItems.split('\n').map((item, index) => {
            return (
              <MenuItem value={item} key={index}>
                {item}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Box>
  );
};

export default SelectType;

export const SelectGroupType: FC = (props) => {
  const { item, ...rest } = props;

  const [select, setSelect] = useState('');

  const handleChange = (event) => {
    setSelect(event.target.value);
  };

  return (
    <Box {...rest}>
      <FormControl style={{ width: 'fit-content' }}>
        <Select
          labelId="select-type"
          id="select-type"
          value={select}
          onChange={handleChange}
          displayEmpty
          MenuProps={{
            getContentAnchorEl: null,
            anchorOrigin: {
              vertical: 'bottom',
              horizontal: 'left',
            },
          }}>
          <MenuItem value="" disabled>
            {item.placeholder}
          </MenuItem>
          {item.menuItems.split('\n').map((item, index) => {
            return (
              <MenuItem value={item} key={index}>
                {item}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Box>
  );
};

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import React, { useState } from 'react';
import slugify from '../../../../utils/slugify';

const useStyles = makeStyles((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    padding: theme.spacing(2),
  },
  textField: {
    marginBottom: theme.spacing(1),
  },
  info: {
    width: '100%',
    fontSize: 14,
    marginBottom: theme.spacing(3),
  },
}));

const SelectForm = ({
  drawerData,
  readOnly,
  onSubmit,
  onClose,
  selectedItem,
  ...rest
}) => {
  const classes = useStyles();

  const [selectData, setSelectData] = useState({
    name: selectedItem ? selectedItem.name : '',
    id: selectedItem ? selectedItem.id : '',
    placeholder: selectedItem ? selectedItem.placeholder : '',
    menuItems: selectedItem ? selectedItem.menuItems : '',
    type: selectedItem ? selectedItem.type : drawerData.type,
  });

  const handleFieldName = (event) => {
    const slug = slugify(event.target.value);
    setSelectData({ ...selectData, name: event.target.value, id: slug });
  };

  const handleApiId = (event) => {
    setSelectData({ ...selectData, id: event.target.value });
  };

  const handleFieldPlaceholder = (event) => {
    setSelectData({ ...selectData, placeholder: event.target.value });
  };

  const handleOptions = (event) => {
    setSelectData({ ...selectData, menuItems: event.target.value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(selectData);

    setSelectData({
      name: '',
      id: '',
      placeholder: '',
      menuItems: '',
      type: '',
    });
  };

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className={classes.form} {...rest}>
      <TextField
        id="Field Name"
        label="Field Name"
        onChange={handleFieldName}
        value={selectData.name}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
        InputProps={{
          readOnly: readOnly && !!selectedItem,
        }}
      />
      <Typography variant={'body2'} className={classes.info}>
        It will appear in the entry editor
      </Typography>
      <TextField
        id="API ID"
        label="API ID"
        onChange={handleApiId}
        value={selectData.id}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={'body2'} className={classes.info}>
        It's generated automatically based on the name and will appear in the API
        responses
      </Typography>
      <TextField
        id="Field Placeholder"
        label="Field Placeholder"
        onChange={handleFieldPlaceholder}
        value={selectData.placeholder}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={'body2'} className={classes.info}>
        Placeholder to appear in the editor
      </Typography>
      <TextField
        id="Options"
        label="Options (Define one option per line)"
        multiline
        rows="4"
        onChange={handleOptions}
        value={selectData.menuItems}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
      />
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
};

export default SelectForm;

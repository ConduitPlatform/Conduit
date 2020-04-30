import React, { useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import Input from '@material-ui/core/Input';
import SaveIcon from '@material-ui/icons/Save';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Link from 'next/link';

export const headerHeight = 64;

const useStyles = makeStyles((theme) => ({
  header: {
    height: headerHeight,
    backgroundColor: theme.palette.primary.main,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'fixed',
    top: 0,
    right: 0,
    left: 0,
  },
  input: {
    height: theme.spacing(5),
    '&:hover': {
      border: '1px solid',
      borderColor: 'rgba(255,255,255,0.5)',
    },
  },
  backIconContainer: {
    height: theme.spacing(8),
    width: theme.spacing(8),
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#003F9E',
    marginRight: theme.spacing(3),
    cursor: 'pointer',
  },
  backIcon: {
    height: theme.spacing(5),
    width: theme.spacing(5),
  },
  selectMenu: {
    backgroundColor: theme.palette.primary.main,
  },
  saveButton: {
    margin: theme.spacing(0, 2),
  },
  saveIcon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginRight: theme.spacing(1),
  },
  colorWhite: {
    color: theme.palette.common.white,
  },
}));

export default function Header(props) {
  const { name, handleSave, ...rest } = props;
  const classes = useStyles();

  const [type, setType] = useState('Singleton type');

  const [dataName, setDataName] = useState(name);

  const handleDataName = (event) => {
    setDataName(event.target.value);
  };

  const handleChange = (event) => {
    setType(event.target.value);
  };

  const handleData = () => {
    handleSave(type, dataName);
  };

  return (
    <Box className={clsx(classes.header, classes.colorWhite)} {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        <Link href="/cms">
          <a style={{ textDecoration: 'none' }}>
            <Box className={classes.backIconContainer}>
              <ArrowBackIcon className={clsx(classes.backIcon, classes.colorWhite)} />
            </Box>
          </a>
        </Link>
        <Input
          className={clsx(classes.input, classes.colorWhite)}
          id="data name"
          onChange={handleDataName}
          disableUnderline
          value={dataName}
        />
      </Box>
      <Box display={'flex'} alignItems={'center'}>
        <FormControl>
          <Select
            labelId="select-type"
            id="select-type"
            value={type}
            classes={{ icon: clsx(classes.selectIcon, classes.colorWhite) }}
            className={classes.colorWhite}
            disableUnderline
            onChange={handleChange}
            MenuProps={{
              classes: { paper: clsx(classes.selectMenu, classes.colorWhite) },
              getContentAnchorEl: null,
              anchorOrigin: {
                vertical: 'bottom',
                horizontal: 'left',
              },
            }}>
            <MenuItem value="Singleton type">Singleton type</MenuItem>
            <MenuItem value="Repeatable type">Repeatable type</MenuItem>
          </Select>
        </FormControl>
        <Button className={clsx(classes.saveButton, classes.colorWhite)} onClick={() => handleData()}>
          <SaveIcon className={classes.saveIcon} />
          <Typography>Save</Typography>
        </Button>
      </Box>
    </Box>
  );
}

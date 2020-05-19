import React, { useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import Input from '@material-ui/core/Input';
import SaveIcon from '@material-ui/icons/Save';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import Link from 'next/link';
import { useDispatch } from 'react-redux';
import { clearSelectedSchema } from "../../redux/actions";

export const headerHeight = 64;

const useStyles = makeStyles((theme) => ({
  header: {
    zIndex: 999,
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
    padding: theme.spacing(1),
    '&:hover': {
      border: '1px solid',
      borderColor: 'rgba(255,255,255,0.5)',
    },
    borderBottom: '1px solid rgba(255,255,255,0.5)',
  },
  backIconContainer: {
    height: theme.spacing(8),
    width: theme.spacing(8),
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
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

const Header = (props) => {
  const { name, handleSave, ...rest } = props;
  const classes = useStyles();
  const dispatch = useDispatch();

  const [schemaName, setSchemaName] = useState(name);

  useEffect(() => {
    setSchemaName(name);
  }, [name]);

  const handleDataName = (event) => {
    setSchemaName(event.target.value);
  };

  const handleData = () => {
    handleSave(schemaName);
  };

  const handleBackButtonClick = () => {
    dispatch(clearSelectedSchema());
  };

  return (
    <Box className={clsx(classes.header, classes.colorWhite)} {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        <Link href="/cms">
          {/* TODO call dispatch clear cms */}
          <a style={{ textDecoration: 'none' }} onClick={handleBackButtonClick}>
            <Box className={classes.backIconContainer}>
              <ArrowBackIcon className={clsx(classes.backIcon, classes.colorWhite)} />
            </Box>
          </a>
        </Link>
        <Input
          className={clsx(classes.input, classes.colorWhite)}
          id="data-name"
          placeholder={'Schema name'}
          onChange={handleDataName}
          disableUnderline
          value={schemaName}
        />
      </Box>
      <Box display={'flex'} alignItems={'center'}>
        <Button className={clsx(classes.saveButton, classes.colorWhite)} onClick={() => handleData()}>
          <SaveIcon className={classes.saveIcon} />
          <Typography>Save</Typography>
        </Button>
      </Box>
    </Box>
  );
};

export default Header;

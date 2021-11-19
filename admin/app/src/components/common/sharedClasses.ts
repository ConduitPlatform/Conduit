import { createStyles, makeStyles } from '@material-ui/core';

export default makeStyles((theme) =>
  createStyles({
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
      marginTop: '-30px',
    },
    chip: {
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap',
      '& > *': {
        margin: theme.spacing(0.5),
      },
      marginTop: '50px',
    },
    fields: {
      marginTop: theme.spacing(0.5),
      display: 'flex',
      marginBottom: theme.spacing(0.5),
      alignItems: 'center',
      width: '80%',
      justifyContent: 'center',
    },
    marginRight: {
      marginRight: theme.spacing(2),
    },
    formFields: {
      minWidth: 200,
    },
    noContent: {
      textAlign: 'center',
      marginTop: '200px',
    },
    saveButton: {
      marginRight: theme.spacing(1),
    },
    selectedElements: {
      margin: theme.spacing(2, 0),
    },
  })
);

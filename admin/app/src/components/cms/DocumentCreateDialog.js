import Box from '@material-ui/core/Box';
import React, { useEffect, useState } from 'react';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';

const useStyles = makeStyles((theme) => ({
  headerContainer: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  'MuiInputBase-root': {
    background: 'red',
  },
  // input: {
  //   border: '1px solid',
  //   borderColor: theme.palette.secondary.contrastText,
  //   borderRadius: '4px',
  //   padding: '0 10px',
  //   marginLeft: theme.spacing(1),
  //   '&.Mui-focused': {
  //     borderColor: theme.palette.primary.main,
  //   },
  // },
  // label: {
  //   marginTop: theme.spacing(2),
  // },
  divider: {
    width: '100%',
  },
}));

const CreateDialog = ({ schema, handleCancel }) => {
  const classes = useStyles();

  const [document, setDocument] = useState([]);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (schema) {
      initDocument();
    }
  }, [schema]);

  const initDocument = () => {
    const fields = schema.fields;
    const documentFields = deconstructFields(fields);
    console.log(documentFields);
    setDocument(documentFields);
  };

  const deconstructFields = (fields) => {
    const documentKeys = Object.keys(fields);
    let documentFields = [];
    documentKeys.forEach((k) => {
      if (typeof fields[k] !== 'string') {
        if (fields[k].type && typeof fields[k].type !== 'string') {
          const innerFields = fields[k].type;
          documentFields.push({ name: k, fields: deconstructFields(innerFields) });
        } else {
          documentFields.push({ name: k, ...fields[k], value: fields[k].default });
        }
      }
    });
    return documentFields;
  };

  const handleCancelClick = () => {
    handleCancel();
  };

  const handleSaveClick = () => {
    console.log(document);
  };

  const handleValueChange = (index, indexInner, event) => {
    // const type = document[index].type;
    // console.log(type);
    // if (type.toString().toLowerCase() === 'boolean') {
    //   document[index].value = Boolean(event.target.value);
    // } else if (type.toString().toLowerCase() === 'number') {
    //   document[index].value = Number(event.target.value);
    // } else {
    document[index].value = event.target.value;
    // }
  };

  return (
    <>
      <Box className={classes.headerContainer} padding={2}>
        <Typography variant={'h5'}>Add a document</Typography>
        <Typography variant={'subtitle1'}>/{schema.name}</Typography>
      </Box>

      <Box padding={6}>
        <Grid container spacing={2} alignItems={'center'} justify={'flex-start'}>
          <Grid item xs={2}>
            <Typography variant={'body1'}>Field</Typography>
          </Grid>
          <Grid item xs={1} />
          <Grid item xs={2}>
            <Typography variant={'body1'}>Type</Typography>
          </Grid>
          <Grid item xs={1} />
          <Grid item xs={3}>
            <Typography variant={'body1'}>Value</Typography>
          </Grid>
          <Grid item xs={12}>
            <Divider className={classes.divider} />
          </Grid>
        </Grid>
        {document.map((doc, index) => (
          <Grid key={'key-' + doc.name} container spacing={2} alignItems={'center'} justify={'flex-start'}>
            <Grid item xs={2}>
              <Typography variant={'body1'}>{doc.name}</Typography>
            </Grid>
            <Grid item xs={1}>
              <Typography variant={'body1'}>:</Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant={'caption'}>{doc.type}</Typography>
            </Grid>
            <Grid item xs={1}>
              <Typography variant={'caption'}>=</Typography>
            </Grid>
            <Grid item container justify={'center'} xs={3}>
              {doc.type.toString().toLowerCase() === 'boolean' && (
                <Switch
                  color={'primary'}
                  value={doc.value}
                  onChange={(e) => {
                    handleValueChange(index, 0, e);
                  }}
                />
              )}
              {doc.type.toString().toLowerCase() === 'string' && (
                <TextField
                  type={'text'}
                  variant={'outlined'}
                  size={'small'}
                  value={doc.value}
                  onChange={(e) => {
                    handleValueChange(index, 0, e);
                  }}
                />
              )}
              {doc.type.toString().toLowerCase() === 'number' && (
                <TextField
                  type={'number'}
                  variant={'outlined'}
                  size={'small'}
                  value={doc.value}
                  onChange={(e) => {
                    handleValueChange(index, 0, e);
                  }}
                />
              )}
            </Grid>
          </Grid>
        ))}
      </Box>

      <Divider className={classes.divider} />

      <Box padding={2} width={'100%'} display={'inline-flex'} justifyContent={'flex-end'} alignItems={'center'}>
        <Grid container>
          <Grid item container xs={12} justify={'flex-end'}>
            <Button variant={'outlined'} style={{ marginRight: 16 }} onClick={handleCancelClick}>
              Cancel
            </Button>
            <Button variant={'outlined'} onClick={handleSaveClick}>
              Save
            </Button>
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

export default CreateDialog;

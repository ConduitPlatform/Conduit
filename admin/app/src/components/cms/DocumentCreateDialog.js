import Box from '@material-ui/core/Box';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import { Select } from '@material-ui/core';
import { createSchemaDocument } from '../../redux/thunks/cmsThunks';

const useStyles = makeStyles((theme) => ({
  headerContainer: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  'MuiInputBase-root': {
    background: 'red',
  },
  divider: {
    width: '100%',
  },
  'MuiSelect-root': {},
}));

const CreateDialog = ({ schema, handleCancel }) => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const [document, setDocument] = useState([]);

  useEffect(() => {
    if (schema) {
      initDocument();
    }
  }, [schema]);

  const initDocument = () => {
    const fields = schema.fields;
    const documentFields = deconstructFields(fields);
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
    dispatch(createSchemaDocument(schema.name, document));
    handleCancel();
  };

  const handleValueChange = (index, indexInner, event) => {
    const newValue = event.target.value;
    const currentDocuments = document.slice();
    const type = currentDocuments[index].type.toString().toLowerCase();
    if (type === 'boolean') {
      document[index].value = Boolean(event.target.value);
    } else if (type === 'number') {
      document[index].value = Number(event.target.value);
    } else {
      document[index].value = event.target.value;
    }
    currentDocuments[index].value = newValue;
    setDocument(currentDocuments);
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
              {doc.type.toString().toLowerCase() === 'relation' && (
                <Select
                  variant={'outlined'}
                  size={'small'}
                  value={doc.value}
                  fullWidth
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

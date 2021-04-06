import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import React, { useCallback, useEffect, useState } from 'react';
import DocumentCreateFields from './DocumentCreateFields';

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
  GridContainer: {
    background: 'rgba(0, 83, 156, .07)',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    borderRadius: 4,
  },
  Divider: {
    marginBottom: theme.spacing(1),
  },
}));

const CreateDialog = ({ schema, handleCreate, handleEdit, handleCancel, editData }) => {
  const classes = useStyles();
  const [document, setDocument] = useState([]);

  const populateEditData = useCallback(
    (documentsData) => {
      if (!editData) return;
      const keys = Object.keys(editData);
      // eslint-disable-next-line no-unused-expressions
      keys?.forEach((k) => {
        const found = documentsData?.find((d) => d.name === k);
        if (found) {
          found.value = editData[k];
        }
      });
    },
    [editData]
  );

  const deconstructFields = useCallback((fields) => {
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
  }, []);

  const initDocument = useCallback(() => {
    const fields = schema.fields;
    const documentFields = deconstructFields(fields);
    populateEditData(documentFields);
    setDocument(documentFields);
  }, [deconstructFields, populateEditData, schema.fields]);

  useEffect(() => {
    if (schema) {
      initDocument();
      if (document.length > 0) populateEditData();
    }
  }, [document.length, initDocument, populateEditData, schema]);

  const handleCancelClick = () => {
    handleCancel();
  };

  const handleSaveClick = () => {
    if (editData) {
      handleEdit(schema.name, document);
    } else {
      handleCreate(schema.name, document);
    }
  };

  return (
    <>
      <Box className={classes.headerContainer} padding={2}>
        <Typography variant={'h5'}>Add a document</Typography>
        <Typography variant={'subtitle1'}>/{schema.name}</Typography>
      </Box>
      <Box padding={6}>
        <Grid container spacing={2} alignItems={'center'} justify={'flex-start'}>
          <Grid item xs={3}>
            <Typography variant={'body1'}>Field</Typography>
          </Grid>
          <Grid item xs={1} />
          <Grid item xs={3}>
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
        <DocumentCreateFields document={document} setDocument={setDocument} />
      </Box>

      <Divider className={classes.divider} />

      <Box
        padding={2}
        width={'100%'}
        display={'inline-flex'}
        justifyContent={'flex-end'}
        alignItems={'center'}>
        <Grid container>
          <Grid item container xs={12} justify={'flex-end'}>
            <Button
              variant={'outlined'}
              style={{ marginRight: 16 }}
              onClick={handleCancelClick}>
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

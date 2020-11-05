import Box from '@material-ui/core/Box';
import React, { useEffect, useState, useCallback } from 'react';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Switch from '@material-ui/core/Switch';
import { Select } from '@material-ui/core';
import CustomDatepicker from '../CustomDatepicker';

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
      keys.forEach((k) => {
        const found = documentsData.find((d) => d.name === k);
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

  const handleValueChange = (index, indexInner, event) => {
    // const newValue = event.target ? event.target.value : event;
    const activeIndex = indexInner !== null ? indexInner : index;
    let currentDocuments;
    let type;
    if (indexInner === null) {
      currentDocuments = document.slice();
      type = currentDocuments[index].type.toString().toLowerCase();
    } else {
      currentDocuments = document[index];
      currentDocuments = currentDocuments.fields.slice();
      type = currentDocuments[indexInner].type.toString().toLowerCase();
    }
    if (type === 'boolean') {
      currentDocuments[activeIndex].value = Boolean(event.target.checked);
    } else if (type === 'number') {
      currentDocuments[activeIndex].value = Number(event.target.value);
    } else if (type === 'date') {
      currentDocuments[activeIndex].value = event.toISOString();
    } else {
      currentDocuments[activeIndex].value = event.target ? event.target.value : event;
    }
    if (indexInner !== null) {
      const docs = document.slice();
      docs[index].fields = currentDocuments;
      setDocument(docs);
    } else {
      // currentDocuments[activeIndex].value = newValue;
      setDocument(currentDocuments);
    }
  };

  const renderNormalField = (doc, index) => {
    return (
      <Grid
        key={'key-' + doc.name}
        container
        spacing={2}
        alignItems={'center'}
        justify={'flex-start'}
        className={classes.GridContainer}>
        <Grid item xs={3}>
          <Typography variant={'body1'}>{doc.name}</Typography>
        </Grid>
        <Grid item xs={1}>
          <Typography variant={'body1'}>:</Typography>
        </Grid>
        <Grid item xs={3}>
          <Typography variant={'caption'}>{doc.type ? doc.type : 'Object'}</Typography>
        </Grid>
        <Grid item xs={1}>
          <Typography variant={'caption'}>=</Typography>
        </Grid>
        <Grid item container justify={'center'} xs={4}>
          {renderInputFields(doc, index, null)}
        </Grid>
      </Grid>
    );
  };

  const renderObjectField = (doc, index) => {
    return (
      <Grid
        key={'key-' + doc.name}
        container
        spacing={2}
        alignItems={'center'}
        justify={'flex-start'}
        className={classes.GridContainer}>
        <Grid item xs={3}>
          <Typography variant={'body1'}>{doc.name}</Typography>
        </Grid>
        <Grid item xs={9}>
          <Divider />
        </Grid>
        <Grid item xs={12}>
          {doc.fields.map((innerDoc, indexInner) => {
            return (
              <Grid
                key={'key-' + innerDoc.name}
                container
                spacing={1}
                alignItems={'center'}
                justify={'flex-end'}>
                <Grid item xs={1} />
                <Grid item xs={2}>
                  <Typography variant={'body1'}>{`${innerDoc.name}`}</Typography>
                </Grid>
                <Grid item xs={1}>
                  <Typography variant={'caption'}>:</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant={'body1'}>{`${innerDoc.type}`}</Typography>
                </Grid>
                <Grid item xs={1}>
                  <Typography variant={'caption'}>=</Typography>
                </Grid>
                <Grid item container justify={'center'} xs={4}>
                  {renderInputFields(innerDoc, index, indexInner)}
                </Grid>
                <Grid item xs={11}>
                  <Divider className={classes.Divider} />
                </Grid>
              </Grid>
            );
          })}
        </Grid>
      </Grid>
    );
  };

  const renderFields = (documentData) => {
    return documentData.map((doc, index) => {
      return doc.type ? renderNormalField(doc, index) : renderObjectField(doc, index);
    });
  };

  const renderInputFields = (doc, index, innerIndex) => {
    if (doc.type.toString().toLowerCase() === 'boolean') {
      return (
        <Switch
          color={'primary'}
          checked={doc.value}
          onChange={(e) => {
            handleValueChange(index, innerIndex, e);
          }}
        />
      );
    }
    if (doc.type.toString().toLowerCase() === 'string') {
      return (
        <TextField
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(index, innerIndex, e);
          }}
        />
      );
    }
    if (doc.type.toString().toLowerCase() === 'relation') {
      return (
        <TextField
          placeholder={'ex. 5f9ff38b7d691d001ce4a908'}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(index, innerIndex, e);
          }}
        />
      );
    }
    if (doc.type.toString().toLowerCase() === 'objectid') {
      return (
        <TextField
          placeholder={'ex. 5f9ff38b7d691d001ce4a908'}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(index, innerIndex, e);
          }}
        />
      );
    }
    if (doc.type.toString().toLowerCase() === 'date') {
      return (
        <CustomDatepicker
          value={doc.value}
          setValue={(e) => {
            handleValueChange(index, innerIndex, e);
          }}
        />
      );
    }
    if (doc.type.toString().toLowerCase() === 'number') {
      return (
        <TextField
          type={'number'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(index, innerIndex, e);
          }}
        />
      );
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
        {renderFields(document)}
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

import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import React from 'react';
import CustomDatepicker from '../common/CustomDatepicker';
import { makeStyles } from '@material-ui/core/styles';

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

const DocumentCreateFields = ({ document, setDocument }) => {
  const classes = useStyles();

  const handleValueChange = (
    firstIndex = null,
    secondIndex = null,
    thirdIndex = null,
    event
  ) => {
    const newValue = event?.target?.value;
    const documentCopy = document.slice();
    if (firstIndex !== null && secondIndex === null && thirdIndex === null) {
      documentCopy[firstIndex].value = newValue;
      setDocument(documentCopy);
    }
    if (firstIndex !== null && secondIndex !== null && thirdIndex === null) {
      documentCopy[firstIndex].fields[secondIndex].value = newValue;
      setDocument(documentCopy);
    }
    if (firstIndex !== null && secondIndex !== null && thirdIndex !== null) {
      documentCopy[firstIndex].fields[secondIndex].fields[thirdIndex].value = newValue;
      setDocument(documentCopy);
    }
  };

  const findType = (type) => {
    if (!type) {
      return 'Object';
    }
    if (Array.isArray(type)) {
      return `[${type}]`;
    }
    return type;
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
          <Typography variant={'caption'}>{findType(doc.type)}</Typography>
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

  const renderObjectField = (doc, index = null, innerIndexParam = null) => {
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
          {doc?.fields?.map((innerDoc, indexInner) => {
            if (!innerDoc.type) {
              return renderObjectField(innerDoc, index, indexInner, innerIndexParam);
            }
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
                  <Typography variant={'body1'}>{findType(innerDoc.type)}</Typography>
                </Grid>
                <Grid item xs={1}>
                  <Typography variant={'caption'}>=</Typography>
                </Grid>
                <Grid item container justify={'center'} xs={4}>
                  {innerIndexParam
                    ? renderInputFields(innerDoc, index, innerIndexParam, indexInner)
                    : renderInputFields(innerDoc, index, indexInner, innerIndexParam)}
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

  const renderFields = () => {
    return document.map((doc, index) => {
      return doc.type ? renderNormalField(doc, index) : renderObjectField(doc, index);
    });
  };

  const renderInputFields = (doc, firstIndex, secondIndex, thirdIndex) => {
    if (doc?.type?.toString().toLowerCase() === 'boolean') {
      return (
        <Switch
          color={'primary'}
          checked={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'string') {
      return (
        <TextField
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'relation') {
      return (
        <TextField
          placeholder={'ex. 5f9ff38b7d691d001ce4a908'}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'objectid') {
      return (
        <TextField
          placeholder={'ex. 5f9ff38b7d691d001ce4a908'}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'date') {
      return (
        <CustomDatepicker
          value={doc.value}
          setValue={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'number') {
      return (
        <TextField
          type={'number'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, e);
          }}>
          <option aria-label="None" value="">
            None
          </option>
        </TextField>
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'objectid') {
      return (
        <TextField
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, e);
          }}
        />
      );
    }
  };

  return renderFields();
};

export default DocumentCreateFields;

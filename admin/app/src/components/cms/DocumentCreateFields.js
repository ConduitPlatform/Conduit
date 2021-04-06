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

  const renderFields = () => {
    return document.map((doc, index) => {
      return doc.type ? renderNormalField(doc, index) : renderObjectField(doc, index);
    });
  };

  const renderInputFields = (doc, index, innerIndex) => {
    if (doc?.type?.toString().toLowerCase() === 'boolean') {
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
    if (doc?.type?.toString().toLowerCase() === 'string') {
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
    if (doc?.type?.toString().toLowerCase() === 'relation') {
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
    if (doc?.type?.toString().toLowerCase() === 'objectid') {
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
    if (doc?.type?.toString().toLowerCase() === 'date') {
      return (
        <CustomDatepicker
          value={doc.value}
          setValue={(e) => {
            handleValueChange(index, innerIndex, e);
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
            handleValueChange(index, innerIndex, e);
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
            handleValueChange(index, innerIndex, e);
          }}
        />
      );
    }
  };

  return renderFields();
};

export default DocumentCreateFields;

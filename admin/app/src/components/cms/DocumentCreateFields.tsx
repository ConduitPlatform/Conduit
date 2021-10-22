import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import React, { FC } from 'react';
import CustomDatepicker from '../common/CustomDatepicker';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

const useStyles = makeStyles((theme) => ({
  headerContainer: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  'MuiInputBase-root': {
    background: 'red',
  },
  accordion: {
    width: `100%`,
    background: 'rgba(0, 83, 156, .01)',
  },
  accordionSummary: {
    '&.Mui-expanded': {},
  },
  button: {
    padding: 0,
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

interface Props {
  disabled: any;
  document: any;
  setDocument: any;
}

const DocumentCreateFields: FC<Props> = ({ disabled, document, setDocument }) => {
  const classes = useStyles();
  const getCorrectType = (type: any, event: any) => {
    const lowerCaseType = type.toString().toLowerCase();
    if (lowerCaseType === 'boolean') {
      return Boolean(event.target.checked);
    }
    if (lowerCaseType === 'number') {
      return Number(event.target.value);
    }
    if (lowerCaseType === 'date') {
      return event.toISOString();
    }
    return event.target ? event.target.value : event;
  };

  const handleValueChange = (
    firstIndex: number,
    secondIndex?: number,
    thirdIndex?: number,
    arrayIndex?: number,
    event?: any
  ) => {
    const documentCopy = document.slice();
    if (firstIndex !== undefined && secondIndex === undefined && thirdIndex === undefined) {
      if (arrayIndex !== undefined) {
        const type = documentCopy[firstIndex].type[0];
        documentCopy[firstIndex].value[arrayIndex] = getCorrectType(type, event);
        setDocument(documentCopy);
      } else {
        const type = documentCopy[firstIndex].type;
        documentCopy[firstIndex].value = getCorrectType(type, event);
        setDocument(documentCopy);
      }
    }
    if (firstIndex !== undefined && secondIndex !== undefined && thirdIndex === undefined) {
      if (arrayIndex !== undefined) {
        const type = documentCopy[firstIndex].fields[secondIndex].type[0];
        documentCopy[firstIndex].fields[secondIndex].value[arrayIndex] = getCorrectType(
          type,
          event
        );
        setDocument(documentCopy);
      } else {
        const type = documentCopy[firstIndex].fields[secondIndex].type;
        documentCopy[firstIndex].fields[secondIndex].value = getCorrectType(type, event);
        setDocument(documentCopy);
      }
    }
    if (firstIndex !== undefined && secondIndex !== undefined && thirdIndex !== undefined) {
      if (arrayIndex !== undefined) {
        const type = documentCopy[firstIndex].fields[secondIndex].fields[thirdIndex].type[0];

        documentCopy[firstIndex].fields[secondIndex].fields[thirdIndex].value[arrayIndex] =
          getCorrectType(type, event);

        setDocument(documentCopy);
      } else {
        const type = documentCopy[firstIndex].fields[secondIndex].fields[thirdIndex].type;
        documentCopy[firstIndex].fields[secondIndex].fields[thirdIndex].value = getCorrectType(
          type,
          event
        );
        setDocument(documentCopy);
      }
    }
  };

  const findType = (type: any) => {
    if (!type) {
      return 'Object';
    }
    if (Array.isArray(type)) {
      return `[${type}]`;
    }
    return type;
  };

  const getCorrectInitialType = (type: 'boolean' | 'number' | 'date') => {
    const lowerCaseType = type.toString().toLowerCase();
    if (lowerCaseType === 'boolean') {
      return false;
    }
    if (lowerCaseType === 'number') {
      return 0;
    }
    if (lowerCaseType === 'date') {
      return new Date().toISOString();
    }
    return '';
  };

  const addElementOnArray = (index: number, secondIndex?: number, thirdIndex?: number) => {
    const documentCopy = document.slice();
    let newItem;
    let iterableArray;
    if (index !== undefined && secondIndex === undefined && thirdIndex === undefined) {
      newItem = getCorrectInitialType(documentCopy[index].type[0]);

      iterableArray = documentCopy[index].value;
      iterableArray = iterableArray ? [...iterableArray] : [];
      documentCopy[index].value = [...iterableArray, newItem];
    }
    if (index !== undefined && secondIndex !== undefined && thirdIndex === undefined) {
      newItem = getCorrectInitialType(documentCopy[index].fields[secondIndex].type[0]);

      iterableArray = documentCopy[index].fields[secondIndex].value;
      iterableArray = iterableArray ? [...iterableArray] : [];
      documentCopy[index].fields[secondIndex].value = [...iterableArray, newItem];
    }

    if (index !== undefined && secondIndex !== undefined && thirdIndex !== undefined) {
      newItem = getCorrectInitialType(
        documentCopy[index].fields[secondIndex].fields[thirdIndex].type[0]
      );

      iterableArray = documentCopy[index].fields[secondIndex].fields[thirdIndex].value;
      iterableArray = iterableArray ? [...iterableArray] : [];
      documentCopy[index].fields[secondIndex].fields[thirdIndex].value = [
        ...iterableArray,
        newItem,
      ];
    }

    setDocument(documentCopy);
  };

  const renderInputFields = (
    doc: any,
    firstIndex: number,
    secondIndex?: number,
    thirdIndex?: number,
    arrayIndex?: number
  ) => {
    if (doc?.type?.toString().toLowerCase() === 'boolean') {
      return (
        <Switch
          disabled={disabled}
          color={'primary'}
          checked={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, arrayIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'string') {
      return (
        <TextField
          disabled={disabled}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, arrayIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'relation') {
      return (
        <TextField
          disabled={disabled}
          placeholder={'ex. 5f9ff38b7d691d001ce4a908'}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, arrayIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'objectid') {
      return (
        <TextField
          disabled={disabled}
          placeholder={'ex. 5f9ff38b7d691d001ce4a908'}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, arrayIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'date') {
      return (
        <CustomDatepicker
          value={doc.value}
          setValue={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, arrayIndex, e);
          }}
        />
      );
    }
    if (doc?.type?.toString().toLowerCase() === 'number') {
      return (
        <TextField
          disabled={disabled}
          type={'number'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, arrayIndex, e);
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
          disabled={disabled}
          type={'text'}
          variant={'outlined'}
          size={'small'}
          value={doc.value}
          onChange={(e) => {
            handleValueChange(firstIndex, secondIndex, thirdIndex, arrayIndex, e);
          }}
        />
      );
    }
  };

  const renderArrayContent = (
    docs: any,
    firstIndex: number,
    secondIndex?: number,
    thirdIndex?: number
  ) => {
    return (
      <Accordion className={classes.accordion}>
        <AccordionSummary className={classes.accordionSummary} expandIcon={<ExpandMoreIcon />}>
          <Button disableRipple fullWidth className={classes.button}>
            all Elements
          </Button>
        </AccordionSummary>
        <AccordionDetails style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {docs?.value?.map((doc: any, arrayIndex: number) => {
            const data = { value: doc, type: docs.type[0] };
            return (
              <Grid
                key={arrayIndex}
                container
                spacing={2}
                alignItems={'center'}
                justify={'flex-start'}
                className={classes.GridContainer}>
                <Grid item xs={3}>
                  <Typography variant={'body1'}>{arrayIndex}</Typography>
                </Grid>
                <Grid item xs={1}>
                  <Typography variant={'body1'}>:</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant={'caption'}>{docs.type[0]}</Typography>
                </Grid>
                <Grid item xs={1}>
                  <Typography variant={'caption'}>=</Typography>
                </Grid>
                <Grid item container justify={'center'} xs={4}>
                  {renderInputFields(data, firstIndex, secondIndex, thirdIndex, arrayIndex)}
                </Grid>
              </Grid>
            );
          })}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderNormalField = (doc: any, index: number) => {
    const isArray = Array.isArray(doc.type) && typeof doc.type[0] === 'string';
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
          {!isArray ? (
            renderInputFields(doc, index)
          ) : (
            <Button
              disabled={disabled}
              variant={'contained'}
              onClick={() => addElementOnArray(index)}
              color={'primary'}>
              Add element
            </Button>
          )}
        </Grid>
        {isArray && renderArrayContent(doc, index)}
      </Grid>
    );
  };

  const renderObjectField = (doc: any, index: number, innerIndexParam?: number) => {
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
          {doc?.fields?.map((innerDoc: any, indexInner: number) => {
            if (!innerDoc.type) {
              return renderObjectField(innerDoc, index, indexInner);
            }

            const isArray = Array.isArray(innerDoc.type) && typeof innerDoc.type[0] === 'string';

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
                  {!isArray ? (
                    innerIndexParam ? (
                      renderInputFields(innerDoc, index, innerIndexParam, indexInner)
                    ) : (
                      renderInputFields(innerDoc, index, indexInner, innerIndexParam)
                    )
                  ) : (
                    <Button
                      disabled={disabled}
                      variant={'contained'}
                      onClick={() =>
                        innerIndexParam
                          ? addElementOnArray(index, innerIndexParam, indexInner)
                          : addElementOnArray(index, indexInner, innerIndexParam)
                      }
                      color={'primary'}>
                      Add element
                    </Button>
                  )}
                </Grid>
                <Grid item xs={11}>
                  {isArray &&
                    (innerIndexParam
                      ? renderArrayContent(innerDoc, index, innerIndexParam, indexInner)
                      : renderArrayContent(innerDoc, index, indexInner, innerIndexParam))}
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
    return document.map((doc: any, index: number) => {
      return doc.type ? renderNormalField(doc, index) : renderObjectField(doc, index);
    });
  };

  return renderFields();
};

export default DocumentCreateFields;

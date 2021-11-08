import React, { FC } from 'react';
import { Button, Chip, Grid, makeStyles, Typography } from '@material-ui/core';
import { AddCircle } from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  typography: {
    marginBottom: theme.spacing(4),
  },
  chip: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    '& > *': {
      margin: theme.spacing(0.5),
    },
  },
  center: {
    textAlign: 'center',
  },
}));

interface Props {
  selectedElements: string[];
  removeSelectedElement: (value: number) => void;
  handleButtonAction: () => void;
  buttonText: string;
  header: string;
}

const SelectedElements: FC<Props> = ({
  selectedElements,
  removeSelectedElement,
  handleButtonAction,
  buttonText,
  header,
}) => {
  const classes = useStyles();

  return (
    <>
      <Grid item xs={12}>
        <Button
          variant="contained"
          color="secondary"
          endIcon={<AddCircle />}
          onClick={() => handleButtonAction()}>
          {buttonText}
        </Button>
      </Grid>
      {selectedElements.length > 0 && (
        <>
          <Grid className={classes.center} item xs={12}>
            <Typography className={classes.center} variant="caption">
              {header}:
            </Typography>
          </Grid>
          <Grid className={classes.chip} item xs={12}>
            {selectedElements.map((element, index) => (
              <Chip
                key={index}
                size="small"
                label={element}
                onDelete={() => removeSelectedElement(index)}
              />
            ))}
          </Grid>
        </>
      )}
    </>
  );
};

export default SelectedElements;

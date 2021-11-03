import { Chip, Grid, Typography } from '@material-ui/core';
import React from 'react';

interface Props {
  valuesToShow: any;
}

const ExtractView: React.FC<Props> = ({ valuesToShow }) => {
  const humanize = (str) => {
    let i = 0;
    const frags = str.split('_');
    for (i = 0; i < frags.length; i++) {
      frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
    }
    return frags.join(' ');
  };

  const extractInnerObject = (valueToExtract: any) => {
    return Object.entries(valueToExtract).map(([key, value]) => (
      <div key={key}>
        <Chip size="small" label={`${key}: ${value !== '' ? value : '--'}`} />
      </div>
    ));
  };

  return (
    <>
      {Object.entries(valuesToShow).map(([key, value]) => {
        return (
          <Grid key={key} item xs={12}>
            <Typography variant="subtitle2">{humanize(key)}:</Typography>
            <Typography variant="h6">
              {typeof value === 'object' ? extractInnerObject(value) : value}
            </Typography>
          </Grid>
        );
      })}
    </>
  );
};

export default ExtractView;

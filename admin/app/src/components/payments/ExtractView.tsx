import { Chip, Grid, Typography } from '@material-ui/core';
import React from 'react';
import { startCase, camelCase } from 'lodash';

interface Props {
  valuesToShow: any;
}

const ExtractView: React.FC<Props> = ({ valuesToShow }) => {
  const extractInnerObject = (valueToExtract: any) => {
    if (typeof valueToExtract === 'object') {
      return Object.entries(valueToExtract).map(([key, value]) => (
        <div key={key}>
          <Chip size="small" label={`${key}: ${value !== '' ? value : '--'}`} />
        </div>
      ));
    }
    if (typeof valueToExtract === 'boolean') {
      return valueToExtract === true ? 'true' : 'false';
    }

    return valueToExtract as string;
  };

  return (
    <>
      {Object.entries(valuesToShow).map(([key, value]) => {
        return (
          <Grid key={key} item xs={12}>
            <Typography variant="subtitle2">{startCase(camelCase(key))}:</Typography>
            <Typography variant="h6">{extractInnerObject(value)}</Typography>
          </Grid>
        );
      })}
    </>
  );
};

export default ExtractView;

import { Container, Grid, Typography } from '@material-ui/core';
import { GetApp } from '@material-ui/icons';
import Button from '@material-ui/core/Button';
import React from 'react';

const SdksTab = () => {
  return (
    <Container>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant={'h5'}>
            See and download all the available SDKs for conduit
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <Typography variant={'h6'}>GraphQL SDKs</Typography>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<GetApp />}
            onClick={() => {
              window.open(
                'https://tenor.com/view/handgesturesmyt-ok-okay-gif-14118577',
                '_blank'
              );
            }}>
            GraphQL client
          </Button>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SdksTab;

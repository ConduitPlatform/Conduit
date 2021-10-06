import {
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import DeleteIcon from '@material-ui/icons/Delete';
import ClientPlatformEnum from '../../models/ClientPlatformEnum';
import Button from '@material-ui/core/Button';
import React, { ChangeEvent, useEffect, useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useDispatch } from 'react-redux';
import { IClient, IPlatformTypes } from '../../models/settings/SettingsModels';
import {
  asyncDeleteClient,
  asyncGenerateNewClient,
  asyncGetAvailableClients,
} from '../../redux/slices/settingsSlice';
import { useAppSelector } from '../../redux/store';

const useStyles = makeStyles({
  table: {
    maxWidth: 650,
  },
});

const SecretsTab: React.FC = () => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const [platform, setPlatform] = useState<IPlatformTypes>('WEB');

  const handleGenerateNew = () => {
    dispatch(asyncGenerateNewClient(platform));
    setTimeout(() => {
      dispatch(asyncGetAvailableClients());
    }, 140);
  };
  //TODO We don't get an _id from the server for each new client we create
  // so as a workaround we have to refetch-all client in
  // TODO order to be able delete newly made clients

  useEffect(() => {
    dispatch(asyncGetAvailableClients());
  }, [dispatch]);

  const { availableClients } = useAppSelector((state) => state.settingsSlice.data);

  const handleDeletion = (_id: string) => {
    dispatch(asyncDeleteClient(_id));
  };

  return (
    <Container>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant={'h6'}>All available conduit Clients</Typography>
          <Typography variant={'subtitle1'}>
            Below you can see all previously generated Clients, create new ones or delete
            old clients
          </Typography>
        </Grid>
        <Grid item xs={8}>
          <TableContainer>
            <Table className={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell>Client ID</TableCell>
                  <TableCell>Client Secret</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {availableClients.map((client: IClient, index: number) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant={'caption'}>{client.clientId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box style={{ maxWidth: 500 }}>
                        <span style={{ overflowWrap: 'break-word' }}>
                          {client.clientSecret ? client.clientSecret : 'This is a secret'}
                        </span>
                      </Box>
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Typography variant={'caption'}>{client.platform}</Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleDeletion(client._id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={2}>
          <FormControl>
            <InputLabel id="demo-simple-select-label">Platform</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={platform}
              onChange={(event: ChangeEvent<any>) => setPlatform(event.target.value)}>
              <MenuItem value={ClientPlatformEnum.WEB}>WEB</MenuItem>
              <MenuItem value={ClientPlatformEnum.ANDROID}>ANDROID</MenuItem>
              <MenuItem value={ClientPlatformEnum.IOS}>IOS</MenuItem>
              <MenuItem value={ClientPlatformEnum.IPADOS}>IPADOS</MenuItem>
              <MenuItem value={ClientPlatformEnum.LINUX}>LINUX</MenuItem>
              <MenuItem value={ClientPlatformEnum.MACOS}>MACOS</MenuItem>
              <MenuItem value={ClientPlatformEnum.WINDOWS}>WINDOWS</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={2}>
          <Button variant={'contained'} color={'primary'} onClick={handleGenerateNew}>
            Generate new Client
          </Button>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SecretsTab;

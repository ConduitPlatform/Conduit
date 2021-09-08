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
import React, { ChangeEvent, useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useDispatch, useSelector } from 'react-redux';
import { deleteClient, generateNewClient } from '../../redux/thunks/settingsThunks';
import { IClient, IPlatformTypes } from '../../models/settings/SettingsModels';

const useStyles = makeStyles({
  table: {
    maxWidth: 650,
  },
});

const SecretsTab: React.FC = () => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const [platform, setPlatform] = useState<IPlatformTypes>('WEB');

  const { data } = useSelector(
    (state: { settingsReducer: { data: { availableClients: IClient[] } } }) =>
      state.settingsReducer
  );

  const handleDeletion = (_id: string) => {
    dispatch(deleteClient(_id));
  };
  const handleGenerateNew = () => {
    dispatch(generateNewClient(platform));
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
                {data.availableClients.map((client: IClient, index: number) => (
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

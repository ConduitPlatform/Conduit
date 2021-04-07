import { privateRoute } from '../components/utils/privateRoute';
import { Layout } from '../components/navigation/Layout';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import React, { useEffect, useState } from 'react';
import Button from '@material-ui/core/Button';
import { GetApp } from '@material-ui/icons';
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
import makeStyles from '@material-ui/core/styles/makeStyles';
import DeleteIcon from '@material-ui/icons/Delete';
import { useDispatch, useSelector } from 'react-redux';
import {
  deleteClient,
  generateNewClient,
  getAvailableClients,
} from '../redux/thunks/settingsThunks';
import ClientPlatformEnum from '../models/ClientPlatformEnum';
import CoreSettingsTab from '../components/settings/CoreSettingsTab';

const useStyles = makeStyles({
  table: {
    maxWidth: 650,
  },
});

const tabs = [{ title: 'Client SDKs' }, { title: 'Secrets' }, { title: 'Core' }];

const Settings = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const [selected, setSelected] = useState(0);
  const [platform, setPlatform] = useState(ClientPlatformEnum.WEB);

  const { data, loading, error } = useSelector((state) => state.settingsReducer);

  useEffect(() => {
    dispatch(getAvailableClients());
  }, [dispatch]);

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };
  const handleDeletion = (_id) => {
    dispatch(deleteClient(_id));
  };
  const handleGenerateNew = () => {
    dispatch(generateNewClient(platform));
  };

  return (
    <Layout itemSelected={6}>
      <Box p={2}>
        <Typography variant={'h4'}>Global Settings</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
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
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          <Container>
            <Grid container>
              <Grid item xs={12}>
                <Typography variant={'h6'}>All available conduit Clients</Typography>
                <Typography variant={'subtitle1'}>
                  Below you can see all previously generated Clients, create new ones or
                  delete old clients
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
                      {data.availableClients.map((client, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant={'caption'}>{client.clientId}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box style={{ maxWidth: 500 }}>
                              <span style={{ overflowWrap: 'break-word' }}>
                                {client.clientSecret
                                  ? client.clientSecret
                                  : 'This is a secret'}
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
                    onChange={(event) => setPlatform(event.target.value)}>
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
                <Button
                  variant={'contained'}
                  color={'primary'}
                  onClick={handleGenerateNew}>
                  Generate new Client
                </Button>
              </Grid>
            </Grid>
          </Container>
        </Box>
        <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
          <CoreSettingsTab />
        </Box>
      </Box>
    </Layout>
  );
};

export default privateRoute(Settings);

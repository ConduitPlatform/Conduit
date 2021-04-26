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
import React, { useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useDispatch, useSelector } from 'react-redux';
import { deleteClient, generateNewClient } from '../../redux/thunks/settingsThunks';

const useStyles = makeStyles({
  table: {
    maxWidth: 650,
  },
});

const ServiceAccountsTabs = () => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const [platform, setPlatform] = useState(ClientPlatformEnum.WEB);

  const { data } = useSelector((state) => state.settingsReducer);

  const handleDeletion = (_id) => {
    dispatch(deleteClient(_id));
  };
  const handleGenerateNew = () => {
    dispatch(generateNewClient(platform));
  };

  return (
    <Container>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant={'h6'}>All available Service Accounts</Typography>
          <Typography variant={'subtitle1'}>
            Create, delete, refresh your Service Accounts . . .
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
          <Button variant={'contained'} color={'primary'} onClick={handleGenerateNew}>
            Generate new Client
          </Button>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ServiceAccountsTabs;

import TextField from '@material-ui/core/TextField';
import FormControl from '@material-ui/core/FormControl';
import InputAdornment from '@material-ui/core/InputAdornment';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import { makeStyles } from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import React from 'react';

const useStyles = makeStyles((theme) => ({
  margin: {
    margin: theme.spacing(1),
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

interface Props {
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  handleFilterChange: (value: unknown) => void;
}

const SearchFilter: React.FC<Props> = ({ search, setSearch, filter, handleFilterChange }) => {
  const classes = useStyles();

  return (
    <form>
      <Grid container>
        <TextField
          size="small"
          variant="outlined"
          className={classes.margin}
          name="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label="Find user"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl variant="outlined" className={classes.formControl} size="small">
          <InputLabel>Provider</InputLabel>
          <Select
            label="Provider"
            value={filter}
            onChange={(event) => handleFilterChange(event.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="local">Local</MenuItem>
            <MenuItem value="google">Google</MenuItem>
            <MenuItem value="facebook">Facebook</MenuItem>
            <MenuItem value="twitch">Twitch</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </form>
  );
};

export default SearchFilter;

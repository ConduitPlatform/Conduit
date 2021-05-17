import TextField from '@material-ui/core/TextField';
import FormControl from '@material-ui/core/FormControl';
import InputAdornment from '@material-ui/core/InputAdornment';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import { makeStyles } from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';

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

export default function SearchFilter({ search, setSearch, filter, handleFilterChange }) {
  const classes = useStyles();

  return (
    <form>
      <Grid container justify="center">
        <TextField
          size="small"
          variant="outlined"
          className={classes.margin}
          id="input-with-icon-textfield"
          name="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label="Εύρεση χρήστη"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        <FormControl variant="outlined" className={classes.formControl} size="small">
          <InputLabel id="demo-simple-select-label">Sign in method</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            label="Sign in method"
            value={filter.filterValue}
            onChange={handleFilterChange}
            inputProps={{
              name: 'filterValue',
              id: 'outlined-age-native-simple',
            }}>
            <MenuItem value="local">Local</MenuItem>
            <MenuItem value="google">Google</MenuItem>
            <MenuItem value="facebook">Facebook</MenuItem>
            <MenuItem value="twitch">Twitch</MenuItem>
            <MenuItem value="kakao">Kakao</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </form>
  );
}

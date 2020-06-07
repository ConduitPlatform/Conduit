import { createMuiTheme } from '@material-ui/core/styles';

const primary = '#00539C';
const secondary = '#FFD662';
const error = '#DC004E';

const theme = createMuiTheme({
  palette: {
    primary: {
      main: primary,
      contrastText: '#fff',
    },
    secondary: {
      main: secondary,
      contrastText: '#000',
    },
    error: {
      main: error,
      contrastText: '#fff',
    },
  },
});

export default theme;

import { createMuiTheme } from '@material-ui/core/styles';

const primary = '#5B44F2';
const secondary = '#07D9C4';
const error = '#DC004E';
const warning = '#E265AB';
const disabled = '#808080';

const theme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: {
      main: primary,
      contrastText: '#F2F2F2',
    },
    secondary: {
      main: secondary,
      contrastText: '#000',
    },
    error: {
      main: error,
      contrastText: '#fff',
    },
    warning: {
      main: warning,
    },
    background: {
      paper: '#303030',
      default: '#262840',
    },
    action: {
      disabledBackground: disabled,
      disabled: disabled,
    },
  },
  typography: {
    fontFamily: 'JetBrains Mono',
  },
});

export default theme;

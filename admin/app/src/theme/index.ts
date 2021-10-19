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
      disabledBackground: 'transparent',
      disabled: disabled,
    },
  },
  typography: {
    fontFamily: 'JetBrains Mono',
  },
  overrides: {
    MuiCssBaseline: {
      '@global': {
        body: {
          scrollbarColor: '#6b6b6b #2b2b2b',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: '#2b2b2b',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#6b6b6b',
            minHeight: 24,
            border: '3px solid #2b2b2b',
          },
          '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
            backgroundColor: '#959595',
          },
          '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
            backgroundColor: '#959595',
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#959595',
          },
          '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
            backgroundColor: '#2b2b2b',
          },
        },
      },
    },
  },
});

export default theme;

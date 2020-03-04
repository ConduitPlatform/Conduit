import { createMuiTheme } from '@material-ui/core/styles'

const primary = '#00adb5';
const secondary = '#393e46';

const theme = createMuiTheme({
  palette: {
    primary: {
      main: primary,
      contrastText: "#000",
    },
    secondary: {
      main: secondary,
      contrastText: "#fff",
    },
  },
});

export default theme

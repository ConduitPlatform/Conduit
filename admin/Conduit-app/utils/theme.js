import { createMuiTheme } from '@material-ui/core/styles'

const primary = '#552583';
const secondary = '#FDB927';

const theme = createMuiTheme({
  palette: {
    primary: {
      main: primary,
      contrastText: "#fff",
    },
    secondary: {
      main: secondary,
      contrastText: "#000",
    },
  },
});

export default theme

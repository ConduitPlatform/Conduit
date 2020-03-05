import { createMuiTheme } from '@material-ui/core/styles'

const primary = '#00539C';
const secondary = '#FFD662';

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

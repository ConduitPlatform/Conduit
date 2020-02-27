import React from "react";
import Container from "@material-ui/core/Container";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";

const Login = () => (
  <Container maxWidth={'sm'}>
    <Box>
      <Typography variant={"h1"} color={'primary'}>
        Hello new project
      </Typography>
      <Typography variant={"h1"} color={'secondary'}>
        Project new hello
      </Typography>
    </Box>
  </Container>
);

export default Login

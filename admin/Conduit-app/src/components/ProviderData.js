import {Container} from "@material-ui/core";
import React from "react";
import {makeStyles} from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import {Save, Dns} from "@material-ui/icons";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import clsx from "clsx";
import Button from "@material-ui/core/Button";

const useStyles = makeStyles((theme) => ({
	paper: {
		padding: theme.spacing(2),
		color: theme.palette.text.secondary,
	},
	textField: {
		marginBottom: theme.spacing(2)
	},
	simpleTextField: {
		width: '65ch',
	},
	typography: {
		marginBottom: theme.spacing(4)
	}
}));

const ProviderData = () => {
	const classes = useStyles();
	
	return (
		<Container maxWidth="md">
			<Paper className={classes.paper} elevation={5}>
				<Typography variant={"h6"} className={classes.typography}>
					<Dns fontSize={'small'}/>. Email Provider Data
				</Typography>
				<form noValidate autoComplete="off">
					<Grid container>
						<Grid item xs={12}>
							<TextField
								required
								id="outlined-required"
								label="Provider"
								defaultValue="Hello World 👋"
								variant="outlined"
								className={clsx(classes.textField, classes.simpleTextField)}
							/>
						</Grid>
						<Grid item xs={12}>
							<TextField
								required
								id="outlined-required"
								label="Default email"
								variant="outlined"
								className={clsx(classes.textField, classes.simpleTextField)}
							/>
						</Grid>
						<Grid item container justify="flex-end" xs={12}>
							<Button variant="contained"
							        color="primary"
							        startIcon={<Save/>}>
								Save
							</Button>
						</Grid>
					</Grid>
				</form>
			</Paper>
		</Container>
	)
};

export default ProviderData;

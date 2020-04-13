import {Container} from "@material-ui/core";
import React from "react";
import {makeStyles} from '@material-ui/core/styles';
import Typography from "@material-ui/core/Typography";
import {MailOutline, Send} from '@material-ui/icons';
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import clsx from "clsx";

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

const SendEmailForm = () => {
	const classes = useStyles();
	
	return (
		<Container maxWidth="md">
			<Paper className={classes.paper} elevation={5}>
				<Typography variant={"h6"} className={classes.typography}>
					<MailOutline fontSize={'small'}/>. Compose your email
				</Typography>
				<form noValidate autoComplete="off">
					<Grid container>
						<Grid item xs={12}>
							<TextField
								required
								id="outlined-required"
								label="Subject"
								defaultValue="Hello World 👋"
								variant="outlined"
								className={clsx(classes.textField, classes.simpleTextField)}
							/>
						</Grid>
						<Grid item xs={12}>
							<TextField
								required
								id="outlined-required"
								label="Recipient"
								variant="outlined"
								className={clsx(classes.textField, classes.simpleTextField)}
							/>
						</Grid>
						<Grid item xs={12}>
							<TextField
								id="outlined-multiline-static"
								label="Email body"
								multiline
								rows="10"
								variant="outlined"
								placeholder="Write your email here..."
								required
								fullWidth
								className={clsx(classes.textField)}
							/>
						</Grid>
						<Grid item container justify="flex-end" xs={12}>
							<Button variant="contained"
							        color="primary"
							        startIcon={<Send/>}>
								Send
							</Button>
						</Grid>
					</Grid>
				</form>
			</Paper>
		</Container>
	)
};

export default SendEmailForm;

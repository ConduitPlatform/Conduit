import React, {useEffect, useState} from 'react';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import {makeStyles} from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import {Formik} from "formik";
import Snackbar from "@material-ui/core/Snackbar";
import Alert from '@material-ui/lab/Alert';
import {Layout} from "../components/Layout";
import {LockOutlined} from "@material-ui/icons";
import {useDispatch, useSelector} from "react-redux";
import {login} from "../redux/thunks/authenticationThunks";

const useStyles = makeStyles(theme => ({
	paper: {
		marginTop: theme.spacing(8),
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
	},
	avatar: {
		margin: theme.spacing(1),
		backgroundColor: theme.palette.secondary.main,
	},
	form: {
		width: '100%',
		marginTop: theme.spacing(1),
	},
	submit: {
		margin: theme.spacing(3, 0, 2),
	},
}));

export default function Login() {
	
	const authState = useSelector(state => state.authenticationReducer);
	const dispatch = useDispatch();
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	
	useEffect(() => {
		setSnackbarOpen(true)
	}, [authState.error]);
	
	const handleLogin = (values) => {
		dispatch(login(values.username, values.password))
	};
	
	const snackbarAlert = () => {
		if (authState.error) {
			return (
				<Alert variant={'filled'} onClose={handleClose} severity="error">
					'Something went wrong, please try again.'
				</Alert>
			)
		} else {
			return undefined
		}
	};
	
	const handleClose = (event, reason) => {
		if (reason === 'clickaway') {
			return;
		}
		setSnackbarOpen(false);
	};
	
	const classes = useStyles();
	
	return (
		<Layout menuDisabled>
			<Container maxWidth="xs">
				<div className={classes.paper}>
					<Avatar className={classes.avatar}>
						<LockOutlined/>
					</Avatar>
					<Typography variant="h5">
						Sign in
					</Typography>
					<Formik
						style={{width: '100%'}}
						initialValues={{username: '', password: ''}}
						onSubmit={(values, {setSubmitting, resetForm}) => {
							handleLogin(values);
							resetForm({
								values: {username: '', password: ''}
							});
							setSubmitting(false);
						}}
					>
						{({
							  handleSubmit,
							  handleChange,
							  values
						  }) => {
							return (
								<form onSubmit={handleSubmit} className={classes.form}>
									<TextField
										onChange={handleChange}
										value={values.username}
										variant="outlined"
										margin="normal"
										required
										fullWidth
										id="username"
										label="Username"
										type="text"
										name="username"
										autoComplete="username"
										autoFocus
									/>
									<TextField
										onChange={handleChange}
										value={values.password}
										variant="outlined"
										margin="normal"
										required
										fullWidth
										name="password"
										label="Password"
										type="password"
										id="password"
										autoComplete="current-password"
									/>
									<FormControlLabel
										control={<Checkbox value="remember" color="primary"/>}
										label="Remember me"
									/>
									<Button
										type="submit"
										fullWidth
										variant="contained"
										color="primary"
										className={classes.submit}
										disabled={authState.loading}
									>
										Sign In
									</Button>
								</form>
							)
						}}
					</Formik>
					<Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleClose}
					          anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}>
						{snackbarAlert()}
					</Snackbar>
				</div>
			</Container>
		</Layout>
	);
}

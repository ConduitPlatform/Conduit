import {
	setAuthenticationError,
	setAuthenticationToken,
	startAuthenticationLoading,
	stopAuthenticationLoading
} from "../actions";
import {loginRequest} from "../../http/requests";

export const login = (username, password) => {
	return (dispatch) => {
		dispatch(startAuthenticationLoading());
		loginRequest(username, password)
			.then(res => {
				dispatch(stopAuthenticationLoading());
				dispatch(setAuthenticationToken(res.data.token));
				dispatch(setAuthenticationError(null));
			})
			.catch(err => {
				dispatch(stopAuthenticationLoading());
				dispatch(setAuthenticationToken(null));
				dispatch(setAuthenticationError(err));
			})
	}
};

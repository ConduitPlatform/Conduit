import {
	addAuthUsers,
	setAuthUsersError,
	startAuthUsersLoading,
	stopAuthUsersLoading
} from "../actions/authUsersActions";
import {getAuthUsersDataReq} from '../../http/requests'

export const getAuthUsersData = () => {
	return (dispatch, getState) => {
		const {token} = getState().authenticationReducer;
		dispatch(startAuthUsersLoading());
		getAuthUsersDataReq(token, 0, 100)
			.then(res => {
				dispatch(stopAuthUsersLoading());
				dispatch(setAuthUsersError(null));
				dispatch(addAuthUsers(res.data));
			})
			.catch(err => {
				dispatch(stopAuthUsersLoading());
				dispatch(setAuthUsersError(err));
			});
	}
};

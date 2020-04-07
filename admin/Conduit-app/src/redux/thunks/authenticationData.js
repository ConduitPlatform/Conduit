import {addAuthUsers, setAuthUsersError, startAuthUsersLoading, stopAuthUsersLoading} from "../actions/actions";
import {getAuthUsersDataReq} from '../../http/requests'

export const getAuthUsersData = () => {
	return (dispatch) => {
		dispatch(startAuthUsersLoading());
		getAuthUsersDataReq()
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

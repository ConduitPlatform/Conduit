import {
	ADD_AUTH_USERS,
	START_AUTH_USERS_LOADING,
	STOP_AUTH_USERS_LOADING,
	SET_AUTH_USERS_ERROR
} from "../actions/actionTypes";

const initialState = {
	data: null,
	loading: false,
	error: null
};

const authUsersData = (state = initialState, action) => {
	switch (action.type) {
		case ADD_AUTH_USERS:
			return {
				...state,
				data: action.payload
			};
		case START_AUTH_USERS_LOADING:
			return {
				...state,
				loading: true
			};
		case STOP_AUTH_USERS_LOADING:
			return {
				...state,
				loading: false
			};
		case SET_AUTH_USERS_ERROR:
			return {
				...state,
				error: action.payload.error
			};
		default:
			return state
	}
};

export default authUsersData

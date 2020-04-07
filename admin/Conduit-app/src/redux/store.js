import {createStore, applyMiddleware} from 'redux';
import rootReducer from './reducers';
import thunk from 'redux-thunk';

export const initStore = (initialState = {}) => {
	return createStore(rootReducer, initialState, applyMiddleware(thunk));
};

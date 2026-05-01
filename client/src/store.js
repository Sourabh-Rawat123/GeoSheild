import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@features/auth/authSlice'
import predictionsReducer from '@features/predictions/predictionsSlice'
import routesReducer from '@features/routes/routeSlice'

export const store = configureStore({
    reducer: {
        auth: authReducer,
        predictions: predictionsReducer,
        routes: routesReducer,
    },
    devTools: import.meta.env.MODE !== 'production',
})

export default store

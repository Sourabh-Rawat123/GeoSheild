import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@features/auth/authSlice'
import predictionsReducer from '@features/predictions/predictionsSlice'
import alertsReducer from '@features/alerts/alertsSlice'
import mapReducer from '@features/map/mapSlice'

export const store = configureStore({
    reducer: {
        auth: authReducer,
        predictions: predictionsReducer,
        alerts: alertsReducer,
        map: mapReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: ['map/setMapInstance'],
                // Ignore these field paths in all actions
                ignoredActionPaths: ['payload.mapInstance'],
                // Ignore these paths in the state
                ignoredPaths: ['map.mapInstance'],
            },
        }),
    devTools: import.meta.env.MODE !== 'production',
})

export default store

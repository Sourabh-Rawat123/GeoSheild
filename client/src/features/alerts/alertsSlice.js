import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    alerts: [],
    unreadCount: 0,
};

const alertsSlice = createSlice({
    name: 'alerts',
    initialState,
    reducers: {
        addAlert: (state, action) => {
            state.alerts.unshift(action.payload);
            state.unreadCount += 1;
        },
        markAsRead: (state, action) => {
            const alert = state.alerts.find((a) => a.id === action.payload);
            if (alert && !alert.read) {
                alert.read = true;
                state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
        },
        markAllAsRead: (state) => {
            state.alerts.forEach((alert) => {
                alert.read = true;
            });
            state.unreadCount = 0;
        },
        setAlerts: (state, action) => {
            state.alerts = action.payload;
            state.unreadCount = action.payload.filter((a) => !a.read).length;
        },
    },
});

export const { addAlert, markAsRead, markAllAsRead, setAlerts } =
    alertsSlice.actions;
export default alertsSlice.reducer;

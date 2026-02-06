const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

    // Operational error (known error)
    if (err.isOperational) {
        return res.status(err.status).json({
            error: {
                message: err.message,
                status: err.status,
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
            }
        });
    }

    // Programming or unknown error
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
    return res.status(500).json({
        error: {
            message: 'Something went wrong',
            status: 500,
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                details: err.message
            })
        }
    });
};

module.exports = errorHandler;

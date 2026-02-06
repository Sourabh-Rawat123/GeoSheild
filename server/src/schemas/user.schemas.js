const Joi = require("joi");

// User signup schema
const signupSchema = Joi.object({
    name: Joi.string()
        .trim()
        .required()
        .messages({
            'string.empty': 'Name is required'
        }),
    email: Joi.string()
        .email()
        .trim()
        .lowercase()
        .required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Please provide a valid email'
        }),
    password: Joi.string()
        .min(6)
        .required()
        .messages({
            'string.empty': 'Password is required',
            'string.min': 'Password must be at least 6 characters'
        }),
    role: Joi.string()
        .valid('user', 'admin')
        .default('user'),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).default([0, 0]),
        address: Joi.string().allow(''),
        city: Joi.string().allow(''),
        state: Joi.string().allow('')
    }),
    alertPreferences: Joi.object({
        sms: Joi.object({
            enabled: Joi.boolean().default(false),
            phone: Joi.string().allow('')
        }),
        email: Joi.object({
            enabled: Joi.boolean().default(true)
        }),
        whatsapp: Joi.object({
            enabled: Joi.boolean().default(false),
            phone: Joi.string().allow('')
        }),
        severityThreshold: Joi.string()
            .valid('Very Low', 'Low', 'Moderate', 'High', 'Severe')
            .default('Moderate')
    })
});

// User login schema
const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Please provide a valid email'
        }),
    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Password is required'
        })
});

// Update profile schema
const updateProfileSchema = Joi.object({
    name: Joi.string().trim(),
    location: Joi.object({
        type: Joi.string().valid('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2),
        address: Joi.string().allow(''),
        city: Joi.string().allow(''),
        state: Joi.string().allow('')
    }),
    alertPreferences: Joi.object({
        sms: Joi.object({
            enabled: Joi.boolean(),
            phone: Joi.string().allow('')
        }),
        email: Joi.object({
            enabled: Joi.boolean()
        }),
        whatsapp: Joi.object({
            enabled: Joi.boolean(),
            phone: Joi.string().allow('')
        }),
        severityThreshold: Joi.string().valid('Very Low', 'Low', 'Moderate', 'High', 'Severe')
    })
});

module.exports = {
    signupSchema,
    loginSchema,
    updateProfileSchema
};
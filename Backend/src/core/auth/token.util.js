import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';

export const signAccessToken = (payload) => {
    return jwt.sign(payload, config.jwtAccessSecret, {
        expiresIn: config.jwtAccessExpiresIn
    });
};

export const signRefreshToken = (payload) => {
    return jwt.sign(payload, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiresIn
    });
};

export const verifyAccessToken = (token) => {
    return jwt.verify(token, config.jwtAccessSecret);
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.jwtRefreshSecret);
};
export const signRegistrationToken = (payload) => {
    return jwt.sign(payload, config.jwtAccessSecret, {
        expiresIn: '30m' // Valid for 30 minutes for registration
    });
};

export const verifyRegistrationToken = (token) => {
    return jwt.verify(token, config.jwtAccessSecret);
};

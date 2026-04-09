import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    phone: z
        .string()
        .min(1, 'Phone is required')
        .regex(/^[+0-9\s]+$/, 'Phone must contain only digits, +, or spaces')
        .min(8, 'Phone must be at least 8 digits')
        .max(20, 'Phone must be at most 20 digits')
});

export const validateUserOtpRequestDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};


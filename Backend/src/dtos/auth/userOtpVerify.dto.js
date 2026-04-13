import { z } from "zod";
import { ValidationError } from "../../core/auth/errors.js";

const schema = z.object({
  phone: z
    .string()
    .regex(/^[+0-9\s]+$/, "Phone must contain only digits, +, or spaces")
    .min(8, "Phone must be at least 8 digits")
    .max(20, "Phone must be at most 20 digits")
    .optional(),
  otp: z
    .string()
    .length(4, "OTP must be exactly 4 digits")
    .regex(/^\d{4}$/, "OTP must be numeric and exactly 4 digits")
    .optional(),
  registrationToken: z.string().optional(),
  ref: z.string().trim().max(64).optional().or(z.literal("")),
  fcmToken: z.string().optional(),
  platform: z.enum(["web", "mobile"]).optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(25, "Name must be at most 25 characters").regex(/^[A-Za-z\s]+$/, "Name must contain only alphabets and spaces").optional(),
}).refine(data => {
    if (!data.registrationToken && (!data.phone || !data.otp)) {
        return false;
    }
    return true;
}, {
    message: "Phone and OTP are required when not using registration token"
});

export const validateUserOtpVerifyDto = (body) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message);
  }
  return result.data;
};

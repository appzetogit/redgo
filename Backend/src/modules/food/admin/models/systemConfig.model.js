import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, trim: true },
        value: { type: mongoose.Schema.Types.Mixed, required: true },
        description: { type: String, trim: true },
        updatedBy: {
            role: { type: String },
            adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
            at: { type: Date, default: Date.now }
        }
    },
    { collection: 'food_system_configs', timestamps: true }
);

export const FoodSystemConfig = mongoose.model('FoodSystemConfig', systemConfigSchema);

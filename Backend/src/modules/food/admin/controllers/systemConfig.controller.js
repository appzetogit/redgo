import { FoodSystemConfig } from '../models/systemConfig.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';

export async function getConfigs(req, res) {
    const configs = await FoodSystemConfig.find({}).lean();
    res.json({ success: true, data: configs });
}

export async function getConfigByKey(req, res) {
    const { key } = req.params;
    const config = await FoodSystemConfig.findOne({ key }).lean();
    if (!config) throw new NotFoundError('Config not found');
    res.json({ success: true, data: config });
}

export async function updateConfig(req, res) {
    const { key, value, description } = req.body;
    if (!key) throw new ValidationError('Key is required');

    const update = {
        value,
        updatedBy: {
            role: req.user.role,
            adminId: req.user._id,
            at: new Date()
        }
    };
    if (description) update.description = description;

    const config = await FoodSystemConfig.findOneAndUpdate(
        { key },
        { $set: update },
        { upsert: true, new: true }
    );

    res.json({ success: true, data: config });
}

export async function getTakeawayCodStatus(req, res) {
    const config = await FoodSystemConfig.findOne({ key: 'takeaway_cod_enabled' }).lean();
    // Default to false if not set
    res.json({ success: true, enabled: config ? config.value === true : false });
}

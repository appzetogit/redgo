import { FoodSystemConfig } from '../models/systemConfig.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';

// Customization toggles live in FoodSystemConfig as individual keys.
// Keep an allowlist so API can't be used to write arbitrary config keys.
const CUSTOMIZATION_TOGGLES = [
    {
        key: 'takeaway_cod_enabled',
        defaultValue: true, // Backward compatibility: if missing, preserve current behavior (enabled).
        description: 'Global toggle for takeaway COD visibility'
    }
];

function resolveToggleValue(configDoc, defaultValue) {
    if (!configDoc) return defaultValue;
    return configDoc.value === true;
}

function getCustomizationAllowlist() {
    return CUSTOMIZATION_TOGGLES.map(t => t.key);
}

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
    const toggleMeta = CUSTOMIZATION_TOGGLES.find(t => t.key === 'takeaway_cod_enabled');
    const config = await FoodSystemConfig.findOne({ key: 'takeaway_cod_enabled' }).lean();
    const takeawayCodEnabled = resolveToggleValue(config, toggleMeta?.defaultValue ?? true);
    // Keep legacy `enabled` field for compatibility while also returning structured data.
    res.json({
        success: true,
        enabled: takeawayCodEnabled,
        data: { takeaway_cod_enabled: takeawayCodEnabled }
    });
}

export async function getCustomizationSettings(req, res) {
    const keys = getCustomizationAllowlist();
    const docs = await FoodSystemConfig.find({ key: { $in: keys } }).lean();
    const map = new Map(docs.map(d => [d.key, d]));

    const data = {};
    for (const t of CUSTOMIZATION_TOGGLES) {
        data[t.key] = resolveToggleValue(map.get(t.key) || null, t.defaultValue);
    }

    res.json({ success: true, data });
}

export async function updateCustomizationSettings(req, res) {
    const body = req.body ?? {};
    const allowlist = new Set(getCustomizationAllowlist());

    const updates = [];
    for (const [key, value] of Object.entries(body)) {
        if (!allowlist.has(key)) continue;
        if (typeof value !== 'boolean') {
            throw new ValidationError(`${key} must be a boolean`);
        }
        const meta = CUSTOMIZATION_TOGGLES.find(t => t.key === key);
        updates.push({ key, value, description: meta?.description });
    }

    if (updates.length === 0) {
        throw new ValidationError(`No valid customization keys provided. Allowed: ${getCustomizationAllowlist().join(', ')}`);
    }

    await Promise.all(
        updates.map(u =>
            FoodSystemConfig.findOneAndUpdate(
                { key: u.key },
                {
                    $set: {
                        key: u.key,
                        value: u.value,
                        description: u.description,
                        updatedBy: {
                            role: req.user.role,
                            adminId: req.user._id,
                            at: new Date()
                        }
                    }
                },
                { upsert: true, new: true }
            )
        )
    );

    // Return full resolved customization settings (including defaults for missing keys).
    return getCustomizationSettings(req, res);
}

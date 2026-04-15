import { useEffect, useRef, useState } from "react";
import { Settings, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { Card, CardHeader, CardTitle, CardContent } from "@food/components/ui/card";
import { Label } from "@food/components/ui/label";
import { Switch } from "@food/components/ui/switch";

const CUSTOMIZATION_TOGGLES = [
  {
    key: "takeaway_cod_enabled",
    label: "Takeaway COD",
    description:
      "Controls Cash on Delivery (COD) visibility for takeaway orders across the Restaurant panel and User takeaway checkout.",
    defaultValue: true,
  },
];

const getAdminToastOffsetPx = () => {
  // Admin layout applies `lg:ml-80` (expanded) or `lg:ml-20` (collapsed) on main content.
  // To visually center toast within the content area (not full viewport), shift by half of that margin.
  try {
    if (typeof window === "undefined") return 0;
    // Tailwind `lg` starts at 1024px.
    if (window.innerWidth < 1024) return 0;

    const raw = localStorage.getItem("admin_sidebar_state");
    const isCollapsed = raw ? Boolean(JSON.parse(raw)?.isCollapsed) : false;
    return isCollapsed ? 40 : 160; // half of 80px / 320px
  } catch {
    return 0;
  }
};

export default function CustomizationSettings() {
  const [loading, setLoading] = useState(true);
  const [savingByKey, setSavingByKey] = useState({});
  const loadToastShownRef = useRef(false);
  const inFlightReqRef = useRef({}); // key -> requestId
  const unlockTimersRef = useRef({}); // key -> timeoutId
  const [settings, setSettings] = useState(() => {
    const initial = {};
    for (const t of CUSTOMIZATION_TOGGLES) initial[t.key] = t.defaultValue;
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await adminAPI.getCustomizationSettings();
        if (!cancelled) {
          const next = {};
          for (const t of CUSTOMIZATION_TOGGLES) {
            // Missing value must keep default behavior.
            next[t.key] = res?.data?.data?.[t.key] !== false;
          }
          setSettings(next);
        }
      } catch (_error) {
        if (!cancelled) {
          // Avoid spamming if something triggers reload twice.
          if (!loadToastShownRef.current) {
            loadToastShownRef.current = true;
            toast.error("Failed to load customization settings", {
              duration: 2000,
              style: {
                width: "fit-content",
                maxWidth: "calc(100vw - 32px)",
                marginLeft: `${getAdminToastOffsetPx()}px`,
              },
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      cancelled = true;
      // Cleanup any pending unlock timers.
      try {
        for (const k of Object.keys(unlockTimersRef.current || {})) {
          if (unlockTimersRef.current[k]) clearTimeout(unlockTimersRef.current[k]);
        }
      } catch {}
    };
  }, []);

  const handleToggle = async (key, checked) => {
    const prevValue = settings[key];
    // Optimistic UI: flip immediately so it doesn't feel laggy.
    setSettings((prev) => ({ ...prev, [key]: checked }));

    // Mark this toggle as "saving". Use a requestId so rapid toggles don't leave us stuck disabled.
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    inFlightReqRef.current[key] = requestId;
    setSavingByKey((prev) => ({ ...prev, [key]: true }));

    // Failsafe: never keep a toggle disabled forever (e.g., network hang).
    if (unlockTimersRef.current[key]) clearTimeout(unlockTimersRef.current[key]);
    unlockTimersRef.current[key] = setTimeout(() => {
      // If the same request is still in-flight, unlock UI.
      if (inFlightReqRef.current[key] === requestId) {
        inFlightReqRef.current[key] = null;
        setSavingByKey((prev) => ({ ...prev, [key]: false }));
      }
    }, 6000);

    const meta = CUSTOMIZATION_TOGGLES.find((t) => t.key === key);
    const label = meta?.label || key;

    // Show feedback instantly (do not wait for API).
    toast.success(`${label} ${checked ? "ON" : "OFF"}`, {
      duration: 2000,
      style: {
        width: "fit-content",
        maxWidth: "calc(100vw - 32px)",
        marginLeft: `${getAdminToastOffsetPx()}px`,
      },
    });

    try {
      await adminAPI.updateCustomizationSettings({ [key]: checked });
    } catch (_error) {
      // Revert if API fails.
      setSettings((prev) => ({ ...prev, [key]: prevValue }));
      toast.error("Failed to update setting", {
        duration: 2000,
        style: {
          width: "fit-content",
          maxWidth: "calc(100vw - 32px)",
          marginLeft: `${getAdminToastOffsetPx()}px`,
        },
      });
    } finally {
      // Only clear "saving" if this is still the latest request for that toggle.
      if (inFlightReqRef.current[key] === requestId) {
        inFlightReqRef.current[key] = null;
        setSavingByKey((prev) => ({ ...prev, [key]: false }));
      }
      if (unlockTimersRef.current[key]) {
        clearTimeout(unlockTimersRef.current[key]);
        unlockTimersRef.current[key] = null;
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="inline-flex items-center">
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-neutral-800" />
            Customization Settings
          </h1>
        </div>
        <p className="text-neutral-600 mt-1">Control global customization toggles for the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-neutral-700" />
            <CardTitle>Manage All Toggles Here</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {CUSTOMIZATION_TOGGLES.map((t) => (
              <div
                key={t.key}
                className="flex items-start justify-between gap-3 p-3 border rounded-lg bg-neutral-50/50"
              >
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">{t.label}</Label>
                  <p className="text-xs text-neutral-500 leading-snug">{t.description}</p>
                </div>
                <div className="shrink-0 pt-0.5">
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                  ) : (
                    <Switch
                      checked={settings[t.key] !== false}
                      onCheckedChange={(checked) => handleToggle(t.key, checked)}
                      disabled={savingByKey[t.key] === true}
                      className="scale-90 data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-zinc-400 shadow-sm"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useUser, useAuthActions } from "@/stores/auth";
import { SETTING_SPECS, coerceSettings } from "@/config/settings";
import type { SettingKey, UserSettings } from "@/config/settings";
import { saveSettings } from "@/lib/settings-client";
import { SettingField } from "@/components/settings/SettingField";

/** theme and language have their own dedicated tabs (Appearance, Language)
 * with richer controls than a generic <select>, so this tab renders every
 * other SETTING_SPECS entry -- the ones that had no UI anywhere before. */
const EXCLUDED: SettingKey[] = ["theme", "language"];
const VISIBLE_SPECS = SETTING_SPECS.filter((s) => !EXCLUDED.includes(s.key));

export function PreferencesTab() {
  const user = useUser();
  const { updateUser } = useAuthActions();
  const [pending, setPending] = useState<SettingKey | null>(null);

  const settings = useMemo(() => coerceSettings(user?.settings), [user?.settings]);

  const handleChange = async <K extends SettingKey>(key: K, value: UserSettings[K]) => {
    const next = { ...settings, [key]: value };
    updateUser({ settings: next });
    setPending(key);
    try {
      await saveSettings({ [key]: value } as Partial<UserSettings>);
    } finally {
      setPending((p) => (p === key ? null : p));
    }
  };

  return (
    <div className="space-y-5">
      {VISIBLE_SPECS.map((spec) => (
        <SettingField
          key={spec.key}
          spec={spec}
          value={settings[spec.key]}
          onChange={(v) => void handleChange(spec.key, v)}
          disabled={pending === spec.key}
        />
      ))}
    </div>
  );
}

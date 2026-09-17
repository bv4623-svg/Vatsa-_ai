"use client";

import { useTranslations } from "next-intl";
import { getSupportedTimezones } from "@/lib/scheduled-tasks-client/timezones";
import { cn } from "@/lib/utils";
import type { SettingSpec, UserSettings } from "@/config/settings";

/** Renders one SETTING_SPECS entry against its current value. This is the
 * first real consumer of that scaffold -- every field it draws is backed
 * by an actual persisted UserSettings key, never a client-only toggle. */
export function SettingField<K extends keyof UserSettings>({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: SettingSpec<K>;
  value: UserSettings[K];
  onChange: (next: UserSettings[K]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const label = t(spec.labelKey);
  const description = spec.descriptionKey ? t(spec.descriptionKey) : undefined;

  if (spec.kind === "toggle") {
    return (
      <SettingRow label={label} description={description}>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!value as UserSettings[K])}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
            value ? "bg-accent" : "bg-input/30"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background shadow transition-transform",
              value ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
      </SettingRow>
    );
  }

  if (spec.kind === "timezone") {
    const zones = getSupportedTimezones();
    return (
      <SettingRow label={label} description={description} stacked>
        <select
          value={value as string}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as UserSettings[K])}
          className="w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none disabled:opacity-50"
        >
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </SettingRow>
    );
  }

  if (spec.kind === "select" && spec.options) {
    return (
      <SettingRow label={label} description={description} stacked>
        <select
          value={value as string}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as UserSettings[K])}
          className="w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none disabled:opacity-50"
        >
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
          ))}
        </select>
      </SettingRow>
    );
  }

  return null;
}

function SettingRow({
  label,
  description,
  stacked,
  children,
}: {
  label: string;
  description?: string;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  if (stacked) {
    return (
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        <div className="mt-2">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

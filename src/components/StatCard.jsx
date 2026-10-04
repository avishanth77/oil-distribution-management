import React from 'react';

export default function StatCard({ title, value, subtext, icon: Icon, badge, accent = 'amber', trend }) {
  return (
    <div className="p-4 bg-surface-container-lowest border border-outline-variant/40 rounded flex flex-col justify-between shadow-sm hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between text-secondary mb-2">
        <span className="font-label-caps text-[11px] uppercase tracking-wider font-semibold text-secondary">
          {title}
        </span>
        {badge ? (
          <span className="font-label-code text-[10px] text-outline px-1 py-0.5 rounded bg-surface-container-low border border-outline-variant/30 font-semibold">
            {badge}
          </span>
        ) : Icon ? (
          <div className="text-secondary">
            <Icon size={16} />
          </div>
        ) : null}
      </div>

      <div className="font-metric-display text-[26px] font-semibold text-primary tabular-nums tracking-tight font-headline-lg">
        {value}
      </div>

      {(subtext || trend) && (
        <div className="flex items-center gap-1.5 mt-2 font-label-code text-[11px]">
          {trend && (
            <span className="font-semibold text-emerald-700 inline-flex items-center gap-0.5">
              {trend}
            </span>
          )}
          {subtext && <span className="text-secondary truncate">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

import React from 'react';

export default function MetricCard({ title, value, unit, subtitle, icon: Icon, color = "blue", badgeText, badgeColor = "emerald" }) {
  const colorStyles = {
    blue: {
      border: "border-blue-500/20",
      glow: "hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
      iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      accent: "text-blue-400"
    },
    cyan: {
      border: "border-cyan-500/20",
      glow: "hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      iconBg: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
      accent: "text-cyan-400"
    },
    emerald: {
      border: "border-emerald-500/20",
      glow: "hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      accent: "text-emerald-400"
    },
    amber: {
      border: "border-amber-500/20",
      glow: "hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
      iconBg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      accent: "text-amber-400"
    },
    rose: {
      border: "border-rose-500/20",
      glow: "hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]",
      iconBg: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
      accent: "text-rose-400"
    },
    purple: {
      border: "border-purple-500/20",
      glow: "hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      iconBg: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
      accent: "text-purple-400"
    }
  };

  const style = colorStyles[color] || colorStyles.blue;

  return (
    <div className={`relative overflow-hidden bg-slate-900/80 backdrop-blur-md rounded-xl p-5 border ${style.border} ${style.glow} transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-mono">{value}</span>
            {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          </div>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${style.iconBg} transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 truncate">{subtitle}</span>
        {badgeText && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            badgeColor === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
            badgeColor === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            badgeColor === 'rose' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
            'bg-blue-500/10 text-blue-400 border-blue-500/30'
          }`}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

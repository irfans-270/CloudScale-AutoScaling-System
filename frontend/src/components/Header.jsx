import React, { useState, useEffect } from 'react';
import { Activity, Clock, Shield, RefreshCw, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';

export default function Header({ scalingStatus, onQuickDemo, activeTab }) {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const statusText = scalingStatus?.scaling_status || "Stable";
  const currentReplicas = scalingStatus?.current_replicas || 1;
  const inCooldown = scalingStatus?.in_cooldown || false;

  const getStatusBadge = () => {
    if (statusText.includes("Scaling Out")) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)] flex items-center gap-1.5 animate-pulse">
          <ArrowUpRight className="w-3.5 h-3.5" />
          Scaling Out Active
        </span>
      );
    }
    if (statusText.includes("Scaling In")) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center gap-1.5 animate-pulse">
          <ArrowDownRight className="w-3.5 h-3.5" />
          Scaling In Active
        </span>
      );
    }
    if (inCooldown || statusText.includes("Stabilizing")) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/40 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {statusText}
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        Cluster Stable
      </span>
    );
  };

  const titles = {
    overview: 'System Overview & Telemetry',
    replicas: 'Replica Pool & Pod Health',
    scaling: 'Autoscaler Policy Engine',
    loadtest: 'Stress Testing & Workload Simulator',
    events: 'Scaling Events Audit Trail',
    k8s: 'Kubernetes Architecture & Manifests'
  };

  return (
    <header className="h-16 bg-slate-950/70 border-b border-slate-800/80 px-6 flex items-center justify-between backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-white tracking-wide">
          {titles[activeTab] || 'Dashboard'}
        </h2>
        <span className="text-slate-600">/</span>
        <span className="text-xs font-mono text-slate-400">
          CloudScale v1.0
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Scaling Status Badge */}
        {getStatusBadge()}

        {/* Replica Count Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Capacity:</span>
          <span className="font-bold text-white font-mono">{currentReplicas} Pod{currentReplicas > 1 ? 's' : ''}</span>
        </div>

        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{currentTime}</span>
        </div>

        {/* Quick Demo Trigger */}
        <button
          id="header-quick-demo-btn"
          onClick={onQuickDemo}
          className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-md shadow-blue-600/25 transition-all flex items-center gap-1.5"
        >
          ⚡ Run Demo Flow
        </button>
      </div>
    </header>
  );
}

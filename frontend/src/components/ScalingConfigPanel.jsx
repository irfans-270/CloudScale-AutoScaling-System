import React, { useState, useEffect } from 'react';
import { Sliders, Shield, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function ScalingConfigPanel({ config, onUpdateConfig }) {
  const [minReplicas, setMinReplicas] = useState(config?.min_replicas || 1);
  const [maxReplicas, setMaxReplicas] = useState(config?.max_replicas || 4);
  const [scaleOutThreshold, setScaleOutThreshold] = useState(config?.scale_out_threshold || 60);
  const [scaleInThreshold, setScaleInThreshold] = useState(config?.scale_in_threshold || 25);
  const [cooldownSeconds, setCooldownSeconds] = useState(config?.cooldown_seconds || 15);
  const [savedMessage, setSavedMessage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setMinReplicas(config.min_replicas ?? 1);
      setMaxReplicas(config.max_replicas ?? 4);
      setScaleOutThreshold(config.scale_out_threshold ?? 60);
      setScaleInThreshold(config.scale_in_threshold ?? 25);
      setCooldownSeconds(config.cooldown_seconds ?? 15);
    }
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateConfig({
        min_replicas: Number(minReplicas),
        max_replicas: Number(maxReplicas),
        scale_out_threshold: Number(scaleOutThreshold),
        scale_in_threshold: Number(scaleInThreshold),
        cooldown_seconds: Number(cooldownSeconds)
      });
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-6 border border-slate-800 shadow-xl my-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            Horizontal Pod Autoscaler (HPA) Policy Configuration
          </h2>
          <p className="text-xs text-slate-400">
            Tune elasticity limits, trigger thresholds, and oscillation stabilization cooldown.
          </p>
        </div>

        {savedMessage && (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Policy Updated Successfully
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {/* Min Replicas */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Min Replicas</label>
            <input
              id="min-replicas-input"
              type="number"
              min="1"
              max="5"
              value={minReplicas}
              onChange={(e) => setMinReplicas(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Baseline capacity pool</span>
          </div>

          {/* Max Replicas */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Max Replicas</label>
            <input
              id="max-replicas-input"
              type="number"
              min={minReplicas}
              max="10"
              value={maxReplicas}
              onChange={(e) => setMaxReplicas(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Maximum ceiling</span>
          </div>

          {/* Scale Out Threshold */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Scale-Out CPU %</label>
            <input
              id="scale-out-threshold-input"
              type="number"
              min="40"
              max="95"
              value={scaleOutThreshold}
              onChange={(e) => setScaleOutThreshold(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-rose-400 font-mono text-sm focus:border-rose-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">&gt;= {scaleOutThreshold}% triggers scale-out</span>
          </div>

          {/* Scale In Threshold */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Scale-In CPU %</label>
            <input
              id="scale-in-threshold-input"
              type="number"
              min="10"
              max="45"
              value={scaleInThreshold}
              onChange={(e) => setScaleInThreshold(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-emerald-400 font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">&lt;= {scaleInThreshold}% triggers scale-in</span>
          </div>

          {/* Cooldown Period */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Cooldown (Seconds)</label>
            <input
              id="cooldown-seconds-input"
              type="number"
              min="5"
              max="120"
              value={cooldownSeconds}
              onChange={(e) => setCooldownSeconds(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-400 font-mono text-sm focus:border-amber-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Anti-flapping stabilization</span>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            id="apply-scaling-policy-btn"
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Shield className="w-4 h-4" />
            Apply Scaling Policy
          </button>
        </div>
      </form>
    </div>
  );
}

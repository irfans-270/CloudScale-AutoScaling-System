import React, { useState } from 'react';
import { Play, Square, Flame, Gauge, Clock, Users, AlertCircle, CheckCircle } from 'lucide-react';

export default function LoadTestPanel({ loadStatus, onStartLoad, onStopLoad, currentReplicas, cpuUtilization }) {
  const [concurrency, setConcurrency] = useState(20);
  const [duration, setDuration] = useState(45);
  const [intensity, setIntensity] = useState('high');
  const [loadingAction, setLoadingAction] = useState(false);

  const isActive = loadStatus?.is_active || false;
  const remainingSec = loadStatus?.remaining_seconds || 0;
  const elapsedSec = loadStatus?.elapsed_seconds || 0;
  const progressPercent = isActive && duration > 0 ? Math.min(100, Math.round((elapsedSec / duration) * 100)) : 0;

  const handleStart = async () => {
    setLoadingAction(true);
    try {
      await onStartLoad({ concurrency, duration, intensity });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStop = async () => {
    setLoadingAction(true);
    try {
      await onStopLoad();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleQuickDemo = async () => {
    setConcurrency(25);
    setDuration(45);
    setIntensity('high');
    setLoadingAction(true);
    try {
      await onStartLoad({ concurrency: 25, duration: 45, intensity: 'high' });
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-6 border border-slate-800 shadow-xl my-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            Workload Stress Generator & Traffic Simulation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inject synthetic concurrent traffic to test horizontal scaling threshold breach and load redistribution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="quick-demo-scenario-btn"
            onClick={handleQuickDemo}
            disabled={isActive || loadingAction}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-amber-300 hover:border-amber-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            ⚡ Faculty Demo Scenario
          </button>

          {!isActive ? (
            <button
              id="start-load-test-btn"
              onClick={handleStart}
              disabled={loadingAction}
              className="px-5 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              Start Load Test
            </button>
          ) : (
            <button
              id="stop-load-test-btn"
              onClick={handleStop}
              disabled={loadingAction}
              className="px-5 py-2.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 animate-pulse"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Load Test ({remainingSec}s left)
            </button>
          )}
        </div>
      </div>

      {/* Active Load Status Bar */}
      {isActive && (
        <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              Traffic Stress Test In Progress ({loadStatus.concurrency} concurrent requests)
            </span>
            <span className="font-mono text-slate-300">
              {elapsedSec}s elapsed / {remainingSec}s remaining
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>Cluster CPU: <strong className="text-white">{cpuUtilization}%</strong></span>
            <span>Active Pods: <strong className="text-white">{currentReplicas} replicas</strong></span>
            <span>Target: <strong className="text-white">&gt;60% triggers Auto-Scale Out</strong></span>
          </div>
        </div>
      )}

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Concurrency */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              Concurrent Clients
            </label>
            <span className="text-sm font-bold font-mono text-cyan-400">{concurrency} users</span>
          </div>
          <input
            id="load-concurrency-slider"
            type="range"
            min="5"
            max="50"
            step="5"
            value={concurrency}
            disabled={isActive}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <p className="text-[11px] text-slate-500 mt-2">
            Simulates parallel users bombarding `/compute` with bounded CPU iterations.
          </p>
        </div>

        {/* 2. Duration */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Duration (Seconds)
            </label>
            <span className="text-sm font-bold font-mono text-amber-400">{duration}s</span>
          </div>
          <input
            id="load-duration-slider"
            type="range"
            min="15"
            max="120"
            step="15"
            value={duration}
            disabled={isActive}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>15s</span>
            <span>45s</span>
            <span>90s</span>
            <span>120s</span>
          </div>
        </div>

        {/* 3. Intensity */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2.5">
            <Gauge className="w-4 h-4 text-purple-400" />
            Load Target Intensity
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'low', label: 'Low', desc: '~35% CPU' },
              { id: 'high', label: 'High', desc: '~85% CPU' },
              { id: 'stress', label: 'Peak', desc: '~98% CPU' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                disabled={isActive}
                onClick={() => setIntensity(lvl.id)}
                className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                  intensity === lvl.id
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 font-bold shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>{lvl.label}</div>
                <div className="text-[9px] opacity-75">{lvl.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Server, Cpu, HardDrive, Wifi, Activity, CheckCircle2 } from 'lucide-react';

export default function InstanceGrid({ instances = [], clusterCpu = 0 }) {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-5 border border-slate-800 shadow-lg my-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            Active Replica Pool & Workload Balancing
          </h2>
          <p className="text-xs text-slate-400">
            Workload is distributed round-robin across {instances.length} active worker {instances.length === 1 ? 'pod' : 'pods'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {instances.length} Replicas Healthy
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
            Avg CPU: {clusterCpu}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {instances.map((inst, index) => {
          const cpuPercent = inst.cpu_percent || 0;
          const cpuColor = cpuPercent > 70 ? 'bg-rose-500' : cpuPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500';
          const cpuText = cpuPercent > 70 ? 'text-rose-400' : cpuPercent > 50 ? 'text-amber-400' : 'text-emerald-400';

          return (
            <div
              key={inst.id}
              className="bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 transition-all duration-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono">{inst.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{inst.id}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {inst.status}
                  </span>
                </div>

                {/* Per-replica CPU bar */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-cyan-400" /> Pod CPU:
                    </span>
                    <span className={`font-mono font-semibold ${cpuText}`}>{cpuPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${cpuColor} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.min(100, Math.max(5, cpuPercent))}%` }}
                    />
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 rounded-lg p-2 border border-slate-800/70 mb-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Memory</span>
                    <span className="text-slate-200 font-mono flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-purple-400" />
                      {inst.memory_mb} MB
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Handled Reqs</span>
                    <span className="text-slate-200 font-mono flex items-center gap-1">
                      <Activity className="w-3 h-3 text-amber-400" />
                      {inst.requests_served}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer info */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-blue-400" /> {inst.ip}:5000
                </span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {inst.is_simulated ? "Simulated Replica" : "K8s Pod"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

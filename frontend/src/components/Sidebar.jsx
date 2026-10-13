import React from 'react';
import { 
  Cloud, 
  LayoutDashboard, 
  Server, 
  Sliders, 
  Flame, 
  History, 
  FileCode, 
  ShieldCheck,
  Cpu
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, replicaCount, isHealthy = true }) {
  const menuItems = [
    { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'replicas', label: 'Replica Pool & Pods', icon: Server, badge: `${replicaCount} Active` },
    { id: 'scaling', label: 'Auto-Scaling Policy', icon: Sliders },
    { id: 'loadtest', label: 'Load Testing Lab', icon: Flame },
    { id: 'events', label: 'Scaling Event Log', icon: History },
    { id: 'k8s', label: 'Kubernetes Architecture', icon: FileCode }
  ];

  return (
    <aside className="w-64 bg-slate-950/90 border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 p-4 select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-4 mb-4 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Cloud className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              CloudScale
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold block">
              Auto-Scaler &amp; LB
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}-btn`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Cluster Status Footer */}
      <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            System Status
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>
        <div className="space-y-1 text-[10px] text-slate-400 font-mono">
          <div className="flex justify-between">
            <span>Backend API:</span>
            <span className="text-slate-200">127.0.0.1:5000</span>
          </div>
          <div className="flex justify-between">
            <span>Autoscaler:</span>
            <span className="text-cyan-400">Active (1s loop)</span>
          </div>
          <div className="flex justify-between">
            <span>Cluster Mode:</span>
            <span className="text-amber-400">Local Sim</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

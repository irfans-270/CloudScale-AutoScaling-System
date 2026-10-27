import React from 'react';
import { Info, Cloud } from 'lucide-react';

export default function SimulationNotice({ isSimulated = true, mode = 'simulation' }) {
  if (mode === 'aws') {
    return (
      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 my-4 flex items-start gap-3.5 backdrop-blur-sm">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          <Cloud className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wide">
              AWS Live · ap-south-1
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Live Cloud Data
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Connected to AWS Auto Scaling Group, EC2 instances, and Application Load Balancer.
            <span className="text-amber-300 ml-1.5 font-medium">CloudWatch data lags about 1-2 min.</span>
          </p>
        </div>
      </div>
    );
  }

  if (!isSimulated) return null;

  return (
    <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 my-4 flex items-start gap-3.5 backdrop-blur-sm">
      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
        <Info className="w-5 h-5" />
      </div>
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white tracking-wide">
            Local Auto-Scaling Simulation Mode Active
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">
            Windows Local Standalone
          </span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          The scaling controller, round-robin load balancer, threshold monitor, and metrics pipeline are actively executing real computational algorithms in Python. In this local mode, replica instances are managed within a high-fidelity local replica pool. Production Kubernetes manifests (<code>deployment.yaml</code>, <code>hpa.yaml</code>, <code>service.yaml</code>) and Docker configurations are included in the repository for deployment to Minikube or cloud clusters.
        </p>
      </div>
    </div>
  );
}

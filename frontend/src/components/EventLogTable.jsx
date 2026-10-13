import React from 'react';
import { History, ArrowUpRight, ArrowDownRight, Trash2, AlertCircle } from 'lucide-react';

export default function EventLogTable({ events = [], onClearEvents }) {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-6 border border-slate-800 shadow-xl my-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            Scaling Event Audit Log
          </h2>
          <p className="text-xs text-slate-400">
            Immutable log of autoscaler decisions, triggers, and capacity adjustments.
          </p>
        </div>

        {events.length > 0 && (
          <button
            id="clear-events-btn"
            onClick={onClearEvents}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Log
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-10 px-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-400">No Scaling Events Recorded Yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click <strong>Start Load Test</strong> to drive CPU utilization above 60%. The scaling controller will trigger a <code>SCALE_OUT</code> event and log it here!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/60">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Transition</th>
                <th className="py-3 px-4 font-semibold">Measured CPU</th>
                <th className="py-3 px-4 font-semibold">Scaling Reason & Trigger</th>
                <th className="py-3 px-4 font-semibold">Target Environment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {events.map((evt) => {
                const isScaleOut = evt.action === 'SCALE_OUT';
                return (
                  <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {evt.timestamp}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isScaleOut ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 inline-flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                          SCALE_OUT
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 inline-flex items-center gap-1">
                          <ArrowDownRight className="w-3 h-3 text-purple-400" />
                          SCALE_IN
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-white font-bold whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {evt.previous_replicas}
                      </span>
                      <span className="mx-2 text-slate-500">➔</span>
                      <span className={`px-2 py-0.5 rounded font-bold ${isScaleOut ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'}`}>
                        {evt.new_replicas}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold whitespace-nowrap">
                      <span className={isScaleOut ? 'text-rose-400' : 'text-emerald-400'}>
                        {evt.measured_cpu}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-md font-sans text-xs">
                      {evt.reason}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                        {evt.mode}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

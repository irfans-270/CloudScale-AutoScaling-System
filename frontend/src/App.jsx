import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Cpu, 
  Layers, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Sliders, 
  History, 
  FileCode,
  TrendingUp,
  Server
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MetricCard from './components/MetricCard';
import ChartsSection from './components/ChartsSection';
import InstanceGrid from './components/InstanceGrid';
import LoadTestPanel from './components/LoadTestPanel';
import ScalingConfigPanel from './components/ScalingConfigPanel';
import EventLogTable from './components/EventLogTable';
import KubernetesView from './components/KubernetesView';
import SimulationNotice from './components/SimulationNotice';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState({
    cpu_utilization: 12.0,
    requests_per_second: 0.0,
    average_latency_ms: 4.2,
    p95_latency_ms: 8.5,
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0
  });
  const [scalingStatus, setScalingStatus] = useState({
    current_replicas: 1,
    min_replicas: 1,
    max_replicas: 4,
    scaling_status: "Stable",
    in_cooldown: false,
    cooldown_remaining: 0,
    is_simulated: true,
    mode: 'simulation'
  });
  const [scalingConfig, setScalingConfig] = useState({
    min_replicas: 1,
    max_replicas: 4,
    scale_out_threshold: 60,
    scale_in_threshold: 25,
    cooldown_seconds: 15
  });
  const [loadStatus, setLoadStatus] = useState({
    is_active: false,
    concurrency: 20,
    duration_seconds: 45,
    remaining_seconds: 0
  });
  const [instances, setInstances] = useState([]);
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [backendOnline, setBackendOnline] = useState(true);

  // Fetch telemetry
  const fetchTelemetry = useCallback(async () => {
    try {
      const [metricsRes, historyRes, instancesRes, eventsRes] = await Promise.all([
        fetch('/api/metrics').then(r => r.json()),
        fetch('/api/history').then(r => r.json()),
        fetch('/api/instances').then(r => r.json()),
        fetch('/api/events').then(r => r.json())
      ]);

      if (metricsRes.metrics) setMetrics(metricsRes.metrics);
      if (metricsRes.scaling) setScalingStatus(metricsRes.scaling);
      if (metricsRes.load_test) setLoadStatus(metricsRes.load_test);
      if (historyRes.history) setHistory(historyRes.history);
      if (instancesRes.instances) setInstances(instancesRes.instances);
      if (eventsRes.events) setEvents(eventsRes.events);
      setBackendOnline(true);
    } catch (err) {
      console.error('Failed to poll backend:', err);
      setBackendOnline(false);
    }
  }, []);

  // Fetch config once on mount
  useEffect(() => {
    fetch('/api/scaling/config')
      .then(r => r.json())
      .then(cfg => {
        if (cfg) setScalingConfig(cfg);
      })
      .catch(() => {});
  }, []);

  // Poll loop: 1 second interval
  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  // Load test handlers
  const handleStartLoad = async (options) => {
    try {
      const res = await fetch('/api/load/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      const data = await res.json();
      if (data.status) setLoadStatus(data.status);
      await fetchTelemetry();
    } catch (e) {
      console.error('Failed to start load:', e);
    }
  };

  const handleStopLoad = async () => {
    try {
      const res = await fetch('/api/load/stop', { method: 'POST' });
      const data = await res.json();
      if (data.status) setLoadStatus(data.status);
      await fetchTelemetry();
    } catch (e) {
      console.error('Failed to stop load:', e);
    }
  };

  const handleUpdateConfig = async (newConfig) => {
    try {
      const res = await fetch('/api/scaling/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      const data = await res.json();
      if (data.config) setScalingConfig(data.config);
      await fetchTelemetry();
    } catch (e) {
      console.error('Failed to update config:', e);
    }
  };

  const handleClearEvents = async () => {
    try {
      await fetch('/api/events/clear', { method: 'POST' });
      setEvents([]);
    } catch (e) {
      console.error('Failed to clear events:', e);
    }
  };

  const handleQuickDemo = () => {
    setActiveTab('overview');
    handleStartLoad({ concurrency: 25, duration: 45, intensity: 'high' });
  };

  const cpuVal = metrics.cpu_utilization || 0;
  const cpuColor = cpuVal >= 60 ? 'rose' : cpuVal >= 40 ? 'amber' : 'cyan';

  return (
    <div className="flex min-h-screen bg-[#080b12] text-slate-100 antialiased font-sans">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        replicaCount={scalingStatus.current_replicas}
        isHealthy={backendOnline}
        mode={scalingStatus.mode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header 
          scalingStatus={scalingStatus} 
          onQuickDemo={handleQuickDemo}
          activeTab={activeTab}
        />

        <main className="p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Connection Error Banner */}
          {!backendOnline && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs flex items-center justify-between text-rose-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Backend API unreachable at <code>http://127.0.0.1:5000</code>. Verify that the Flask server is running.</span>
              </div>
              <button 
                onClick={fetchTelemetry}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Simulation Notice Banner */}
          <SimulationNotice isSimulated={scalingStatus.is_simulated} mode={scalingStatus.mode} />

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Live Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. CPU Utilization */}
                <MetricCard
                  title="Cluster CPU Utilization"
                  value={`${cpuVal}%`}
                  subtitle={`Scale-Out at ${scalingConfig.scale_out_threshold}% | In at ${scalingConfig.scale_in_threshold}%`}
                  icon={Cpu}
                  color={cpuColor}
                  badgeText={cpuVal >= 60 ? 'HIGH LOAD' : cpuVal <= 25 ? 'IDLE' : 'NORMAL'}
                  badgeColor={cpuVal >= 60 ? 'rose' : cpuVal <= 25 ? 'emerald' : 'blue'}
                />

                {/* 2. Active Replicas */}
                <MetricCard
                  title="Active Replicas"
                  value={scalingStatus.current_replicas}
                  unit={`/ ${scalingStatus.max_replicas} max`}
                  subtitle={`Min: ${scalingStatus.min_replicas} | Max: ${scalingStatus.max_replicas} pods`}
                  icon={Layers}
                  color="emerald"
                  badgeText={scalingStatus.scaling_status}
                  badgeColor={scalingStatus.scaling_status.includes('Scaling Out') ? 'rose' : 'emerald'}
                />

                {/* 3. Incoming Request Rate */}
                <MetricCard
                  title="Throughput (RPS)"
                  value={metrics.requests_per_second}
                  unit="req/s"
                  subtitle={`Processed: ${metrics.total_requests} requests`}
                  icon={Zap}
                  color="amber"
                  badgeText={metrics.requests_per_second > 0 ? 'ACTIVE TRAFFIC' : 'IDLE'}
                  badgeColor={metrics.requests_per_second > 0 ? 'amber' : 'blue'}
                />

                {/* 4. Response Latency */}
                <MetricCard
                  title="Average Latency"
                  value={metrics.average_latency_ms}
                  unit="ms"
                  subtitle={`P95: ${metrics.p95_latency_ms} ms`}
                  icon={Clock}
                  color="purple"
                  badgeText={`${metrics.successful_requests} ok / ${metrics.failed_requests} err`}
                  badgeColor="emerald"
                />
              </div>

              {/* 4 Live Time-Series Charts */}
              <ChartsSection 
                history={history} 
                thresholds={{
                  scale_out: scalingConfig.scale_out_threshold,
                  scale_in: scalingConfig.scale_in_threshold
                }} 
              />

              {/* Load Testing Quick Controller */}
              <LoadTestPanel 
                loadStatus={loadStatus}
                onStartLoad={handleStartLoad}
                onStopLoad={handleStopLoad}
                currentReplicas={scalingStatus.current_replicas}
                cpuUtilization={metrics.cpu_utilization}
              />

              {/* Active Replica Pool */}
              <InstanceGrid 
                instances={instances} 
                clusterCpu={metrics.cpu_utilization} 
              />

              {/* Recent Scaling Events */}
              <EventLogTable 
                events={events} 
                onClearEvents={handleClearEvents} 
              />
            </>
          )}

          {/* TAB 2: REPLICAS */}
          {activeTab === 'replicas' && (
            <div className="space-y-6">
              <InstanceGrid 
                instances={instances} 
                clusterCpu={metrics.cpu_utilization} 
              />
              <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 text-xs">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  Load Balancing &amp; Traffic Distribution Mechanics
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  Incoming client traffic is balanced in round-robin fashion across all healthy active replica instances. When Horizontal Auto-Scaling detects high cluster load (&gt;{scalingConfig.scale_out_threshold}%), a new replica is booted into the pool, increasing cluster compute bandwidth and naturally relieving per-pod CPU utilization.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: AUTO-SCALING POLICY */}
          {activeTab === 'scaling' && (
            <ScalingConfigPanel 
              config={scalingConfig} 
              onUpdateConfig={handleUpdateConfig} 
            />
          )}

          {/* TAB 4: LOAD TESTING */}
          {activeTab === 'loadtest' && (
            <LoadTestPanel 
              loadStatus={loadStatus}
              onStartLoad={handleStartLoad}
              onStopLoad={handleStopLoad}
              currentReplicas={scalingStatus.current_replicas}
              cpuUtilization={metrics.cpu_utilization}
            />
          )}

          {/* TAB 5: SCALING EVENTS */}
          {activeTab === 'events' && (
            <EventLogTable 
              events={events} 
              onClearEvents={handleClearEvents} 
            />
          )}

          {/* TAB 6: KUBERNETES MANIFESTS */}
          {activeTab === 'k8s' && (
            <KubernetesView />
          )}
        </main>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { FileCode, Copy, Check, Terminal, Layers, Cpu, ShieldCheck } from 'lucide-react';

export default function KubernetesView() {
  const [activeTab, setActiveTab] = useState('hpa');
  const [copied, setCopied] = useState(false);

  const manifests = {
    hpa: {
      filename: 'k8s/hpa.yaml',
      description: 'HorizontalPodAutoscaler configuring automated scaling based on average CPU utilization.',
      code: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cloudscale-hpa
  namespace: default
  labels:
    app: cloudscale
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cloudscale-backend
  minReplicas: 1
  maxReplicas: 4
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Pods
        value: 1
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 15
      policies:
      - type: Pods
        value: 1
        periodSeconds: 15`
    },
    deployment: {
      filename: 'k8s/deployment.yaml',
      description: 'Kubernetes Deployment with 1 initial replica, CPU/Memory resource constraints, and health probes.',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudscale-backend
  namespace: default
  labels:
    app: cloudscale-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cloudscale-backend
  template:
    metadata:
      labels:
        app: cloudscale-backend
    spec:
      containers:
      - name: backend
        image: cloudscale-backend:1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 5000
          name: http
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 3
          periodSeconds: 5`
    },
    service: {
      filename: 'k8s/service.yaml',
      description: 'Kubernetes Service providing stable cluster IP and NodePort load balancing across replica pods.',
      code: `apiVersion: v1
kind: Service
metadata:
  name: cloudscale-service
  namespace: default
  labels:
    app: cloudscale-backend
spec:
  type: NodePort
  ports:
  - port: 5000
    targetPort: 5000
    nodePort: 30500
    protocol: TCP
    name: http
  selector:
    app: cloudscale-backend`
    }
  };

  const current = manifests[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-6 border border-slate-800 shadow-xl my-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Cloud Orchestration &amp; Kubernetes Architecture
          </h2>
          <p className="text-xs text-slate-400">
            Real production manifests configured for Minikube, EKS, or GKE deployments.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {Object.keys(manifests).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all uppercase font-mono ${
                activeTab === key
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs text-white font-bold">{current.filename}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all font-mono"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy YAML'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">{current.description}</p>
        <pre className="p-4 bg-slate-900/90 rounded-lg text-emerald-300 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
          {current.code}
        </pre>
      </div>

      {/* Commands Box */}
      <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
        <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2 font-mono">
          <Terminal className="w-4 h-4 text-amber-400" />
          Minikube / Kubernetes Deployment Commands
        </h4>
        <div className="bg-slate-900 p-3 rounded-lg text-xs font-mono text-slate-300 space-y-1">
          <p className="text-slate-500"># 1. Enable metrics server for CPU HPA</p>
          <p className="text-cyan-300">minikube addons enable metrics-server</p>
          <p className="text-slate-500"># 2. Deploy backend, service, and autoscaler</p>
          <p className="text-cyan-300">kubectl apply -f k8s/deployment.yaml</p>
          <p className="text-cyan-300">kubectl apply -f k8s/service.yaml</p>
          <p className="text-cyan-300">kubectl apply -f k8s/hpa.yaml</p>
          <p className="text-slate-500"># 3. Watch real-time pod scaling</p>
          <p className="text-cyan-300">kubectl get hpa cloudscale-hpa --watch</p>
        </div>
      </div>
    </div>
  );
}

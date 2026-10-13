import time
import random
import uuid

class ReplicaInstance:
    def __init__(self, index: int, is_simulated: bool = True):
        self.id = f"cloudscale-pod-{uuid.uuid4().hex[:6]}-{index}"
        self.index = index
        self.status = "Running"
        self.ip = f"10.244.{random.randint(1, 3)}.{10 + index}"
        self.created_at = time.time()
        self.requests_served = 0
        self.is_simulated = is_simulated
        self.base_memory = random.randint(128, 160)

    def to_dict(self, cluster_cpu: float):
        uptime_seconds = int(time.time() - self.created_at)
        # Jitter individual replica CPU slightly to simulate real distributed traffic
        jitter = random.uniform(-2.5, 2.5)
        instance_cpu = max(5.0, min(100.0, round(cluster_cpu + jitter, 1)))
        memory_mb = self.base_memory + int(cluster_cpu * 0.8)

        return {
            "id": self.id,
            "name": f"worker-replica-{self.index}",
            "status": self.status,
            "ip": self.ip,
            "port": 5000,
            "uptime_seconds": uptime_seconds,
            "cpu_percent": instance_cpu,
            "memory_mb": memory_mb,
            "requests_served": self.requests_served,
            "is_simulated": self.is_simulated,
            "role": "Worker Replica (HPA Target)"
        }

class InstanceManager:
    def __init__(self, is_simulated: bool = True):
        self.is_simulated = is_simulated
        self.instances = []
        self._next_index = 1
        # Initialize with 1 base replica
        self.set_replica_count(1)

    def set_replica_count(self, count: int):
        count = max(1, count)
        current_len = len(self.instances)
        
        if count > current_len:
            # Scale out: add new replicas
            for _ in range(count - current_len):
                inst = ReplicaInstance(self._next_index, self.is_simulated)
                self.instances.append(inst)
                self._next_index += 1
        elif count < current_len:
            # Scale in: remove youngest replicas
            self.instances = self.instances[:count]

    def record_request_dispatched(self):
        """Simulate round-robin load balancer dispatching to an instance."""
        if self.instances:
            chosen = random.choice(self.instances)
            chosen.requests_served += 1

    def get_instances(self, cluster_cpu: float):
        return [inst.to_dict(cluster_cpu) for inst in self.instances]

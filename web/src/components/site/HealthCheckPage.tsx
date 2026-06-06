import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

const services = [
  { name: "whimper.wtf", url: "https://whimper.wtf", type: "website" as const },
  { name: "api", url: "https://api.whimper.wtf", type: "api" as const },
  { name: "discord bot", url: "https://api.whimper.wtf", type: "bot" as const },
];

export function HealthCheckPage() {
  const [serviceStates, setServiceStates] = useState<Record<string, { status: string; latency?: number }>>({});
  const [lastChecked, setLastChecked] = useState("");

  const checkService = async (service: typeof services[0]) => {
    const key = service.name;
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      await fetch(service.url, {
        method: 'GET',
        signal: controller.signal,
        mode: service.type === 'website' ? 'no-cors' : 'cors',
      });

      clearTimeout(timeout);
      const latency = Date.now() - start;

      setServiceStates(prev => ({
        ...prev,
        [key]: { 
          status: 'Healthy', 
          latency: service.type !== 'website' ? latency : undefined 
        }
      }));
    } catch {
      setServiceStates(prev => ({
        ...prev,
        [key]: { status: 'Down' }
      }));
    }
  };

  const checkAll = async () => {
    setLastChecked(new Date().toLocaleTimeString());
    setServiceStates({});

    for (const service of services) {
      await checkService(service);
    }
  };

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-purple-300 to-purple-500 bg-clip-text text-transparent">
              Health Check
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">Real-time monitoring of all services</p>
          </div>
          <button
            onClick={checkAll}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-2xl font-medium flex items-center gap-2 transition-all active:scale-95"
          >
            <Heart className="w-5 h-5" />
            Refresh All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service) => {
            const state = serviceStates[service.name];
            const isDown = state?.status === 'Down';

            return (
              <div key={service.name} className="bg-card border border-border rounded-3xl p-8 hover:border-purple-500/50 transition-colors">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-semibold">{service.name}</h3>
                  <div className={`w-4 h-4 rounded-full transition-all ${isDown ? 'bg-red-500 ring-red-500/30' : 'bg-green-500 ring-green-500/30'} ring-2 ring-offset-2 ring-offset-card`} />
                </div>

                <div className="space-y-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-semibold ${isDown ? 'text-red-500' : 'text-green-500'}`}>
                      {state?.status || "Checking..."}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize font-medium">{service.type}</span>
                  </div>
                  {state?.latency && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latency</span>
                      <span className="font-mono text-green-400">{state.latency}ms</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-muted-foreground mt-12 text-sm">
          Last checked: {lastChecked || "—"}
        </p>
      </div>
    </div>
  );
}
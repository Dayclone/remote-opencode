import { spawn, type ChildProcess } from 'node:child_process';
import { Server } from 'node:net';
import type { ServeInstance } from '../types/index.js';

const PORT_MIN = 14097;
const PORT_MAX = 14200;

const instances = new Map<string, ServeInstance>();

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = new Server();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.listen(port);
  });
}

async function findAvailablePort(): Promise<number> {
  for (let port = PORT_MIN; port <= PORT_MAX; port++) {
    const usedPorts = new Set(Array.from(instances.values()).map(i => i.port));
    if (!usedPorts.has(port) && await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports in range ${PORT_MIN}-${PORT_MAX}`);
}

async function isServerResponding(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/session`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function cleanupInstance(key: string): void {
  instances.delete(key);
}

export async function spawnServe(projectPath: string, model?: string): Promise<number> {
  const key = model ? `${projectPath}:${model}` : projectPath;
  const existing = instances.get(key);
  if (existing) {
    return existing.port;
  }

  const port = await findAvailablePort();
  
  const args = ['serve', '--port', port.toString(), '--hostname', '0.0.0.0'];
  if (model) {
    args.push('--model', model);
  }

  const child = spawn('opencode', args, {
    cwd: projectPath,
    env: { ...process.env },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});

  const instance: ServeInstance = {
    port,
    process: child,
    startTime: Date.now(),
  };

  instances.set(key, instance);

  child.on('exit', async () => {
    const inst = instances.get(key);
    if (inst) {
      const stillRunning = await isServerResponding(inst.port);
      if (!stillRunning) {
        cleanupInstance(key);
      }
    }
  });

  child.on('error', () => {
    cleanupInstance(key);
  });

  return port;
}

export function getPort(projectPath: string, model?: string): number | undefined {
  const key = model ? `${projectPath}:${model}` : projectPath;
  return instances.get(key)?.port;
}

export function stopServe(projectPath: string, model?: string): boolean {
  const key = model ? `${projectPath}:${model}` : projectPath;
  const instance = instances.get(key);
  if (!instance) {
    return false;
  }

  instance.process.kill();
  cleanupInstance(key);
  return true;
}

export async function waitForReady(port: number, timeout: number = 10000): Promise<void> {
  const start = Date.now();
  const url = `http://127.0.0.1:${port}/session`;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Service at port ${port} failed to become ready within ${timeout}ms`);
}

export function stopAll(): void {
  for (const [key, instance] of instances) {
    instance.process.kill();
    cleanupInstance(key);
  }
}

export function getAllInstances(): Array<{ key: string; port: number }> {
  return Array.from(instances.entries()).map(([key, instance]) => ({
    key,
    port: instance.port,
  }));
}

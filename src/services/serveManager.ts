import { spawn, type ChildProcess } from 'node:child_process';
import { Server } from 'node:net';
import type { ServeInstance } from '../types/index.js';
import { getPortConfig } from './configStore.js';

const DEFAULT_PORT_MIN = 14097;
const DEFAULT_PORT_MAX = 14200;

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
  const config = getPortConfig();
  const min = config?.min ?? DEFAULT_PORT_MIN;
  const max = config?.max ?? DEFAULT_PORT_MAX;

  for (let port = min; port <= max; port++) {
    const usedPorts = new Set(Array.from(instances.values()).map(i => i.port));
    if (!usedPorts.has(port) && await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports in range ${min}-${max}`);
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
  const key = projectPath;
  const existing = instances.get(key);
  if (existing) {
    return existing.port;
  }

  const port = await findAvailablePort();
  
  const args = ['serve', '--port', port.toString(), '--hostname', '0.0.0.0'];
  
  const child = spawn('opencode', args, {
    cwd: projectPath,
    env: { ...process.env },
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  child.stdout?.on('data', (data) => {
    if (process.env.DEBUG) console.log(`[opencode stdout] ${data.toString()}`);
  });
  child.stderr?.on('data', (data) => {
    if (process.env.DEBUG) console.error(`[opencode stderr] ${data.toString()}`);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[opencode] Process exited with code ${code}`);
    }
    const inst = instances.get(key);
    if (inst) {
      cleanupInstance(key);
    }
  });

  child.on('error', () => {
    cleanupInstance(key);
  });

  const instance: ServeInstance = {
    port,
    process: child,
    startTime: Date.now(),
  };

  instances.set(key, instance);

  return port;
}

export function getPort(projectPath: string, model?: string): number | undefined {
  const key = projectPath;
  return instances.get(key)?.port;
}

export function stopServe(projectPath: string, model?: string): boolean {
  const key = projectPath;
  const instance = instances.get(key);
  if (!instance) {
    return false;
  }

  instance.process.kill();
  cleanupInstance(key);
  return true;
}

export async function waitForReady(port: number, timeout: number = 30000): Promise<void> {
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Service at port ${port} failed to become ready within ${timeout}ms. Check if 'opencode serve' is working correctly.`);
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

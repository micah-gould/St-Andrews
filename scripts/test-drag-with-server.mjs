import net from "node:net";
import { spawn } from "node:child_process";

const FRONTEND_PORT = 5174;
const BACKEND_PORT = 5175;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for port ${port}`);
}

async function waitForHealthyBackend(timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${BACKEND_PORT}/api/health`,
        {
          method: "GET",
        },
      );

      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for backend health on :${BACKEND_PORT}`);
}

function spawnNpmScript(script) {
  return spawn(npmCommand, ["run", script], {
    stdio: "inherit",
    env: { ...process.env, E2E: "1" },
  });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`${command} ${args.join(" ")} exited with code ${code}`),
      );
    });
  });
}

async function runWithRetry(command, args, attempts = 2) {
  let lastError = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      await runCommand(command, args);
      return;
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        console.warn(`[test:drag] Attempt ${i + 1} failed, retrying once...`);
      }
    }
  }

  throw lastError;
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, 3000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

async function main() {
  const startedProcesses = [];

  try {
    const backendRunning = await isPortOpen(BACKEND_PORT);
    if (!backendRunning) {
      console.log(`[test:drag] Starting backend on :${BACKEND_PORT}`);
      const backend = spawnNpmScript("dev:server");
      startedProcesses.push(backend);
      await waitForPort(BACKEND_PORT);
      await waitForHealthyBackend();
    }

    const frontendRunning = await isPortOpen(FRONTEND_PORT);
    if (!frontendRunning) {
      console.log(`[test:drag] Starting frontend on :${FRONTEND_PORT}`);
      const frontend = spawnNpmScript("dev:client");
      startedProcesses.push(frontend);
      await waitForPort(FRONTEND_PORT);
    }

    if (backendRunning) {
      await waitForHealthyBackend();
    }

    await runWithRetry("node", ["scripts/drag-regression.mjs"], 2);
  } finally {
    await Promise.all(
      startedProcesses.reverse().map((child) => stopProcess(child)),
    );
  }
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});

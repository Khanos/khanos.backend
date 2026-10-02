import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

/** Owns an ephemeral process, loopback port and directory; never reads DB env settings. */
export async function startMongo() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'khanos-mongo-test-'));
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.env.MONGOD_BIN || 'mongod', ['--bind_ip', '127.0.0.1', '--port', String(port),
    '--dbpath', directory, '--nounixsocket', '--logpath', path.join(directory, 'mongod.log')], { stdio: 'ignore' });
  let failed = false;
  child.on('error', () => { failed = true; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  async function stop() {
    if (child.exitCode === null && child.pid) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      await exited;
      clearTimeout(timer);
    }
    await rm(directory, { recursive: true, force: true });
  }
  try {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (failed || child.exitCode !== null) throw new Error('Disposable mongod failed; install MongoDB 8 or set MONGOD_BIN');
      const ready = await new Promise(resolve => {
        const socket = net.connect({ host: '127.0.0.1', port });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => resolve(false));
      });
      if (ready) return { uri: `mongodb://127.0.0.1:${port}/khanos_architecture_test`, stop };
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Disposable mongod startup deadline exceeded');
  } catch (error) { await stop(); throw error; }
}

import net from 'node:net';
import tls from 'node:tls';
import { COUNTER_SCRIPT } from '../../rateLimitStore.js';

// Owned RESP2 fixture exercises the real node-redis wire client. It models the
// fixed-window contract; it is not a Lua interpreter or an external service.
export async function startRedisFixture(tlsOptions) {
  const counters = new Map();
  const commands = [];
  const sockets = new Set();
  let time = 1000;
  let mode = 'normal';
  let connections = 0;
  const onConnection = socket => {
    connections += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length) {
        const parsed = parseCommand(buffer);
        if (!parsed) return;
        buffer = buffer.subarray(parsed.bytes);
        const [command, ...args] = parsed.args;
        commands.push(parsed.args);
        if (command !== 'EVAL') { socket.write('+OK\r\n'); continue; }
        if (mode === 'stalled') continue;
        if (mode === 'failed') { socket.write('-ERR synthetic-private-redis-secret\r\n'); continue; }
        const [script, keys, key, window] = args;
        if (script !== COUNTER_SCRIPT || keys !== '1' || !/^test:backend:[a-f0-9]{64}$/.test(key)) {
          socket.write('-ERR invalid counter contract\r\n'); continue;
        }
        let entry = counters.get(key);
        if (!entry || entry.reset <= time) { entry = { count: 0, reset: time + Number(window) }; counters.set(key, entry); }
        entry.count += 1;
        socket.write(`*2\r\n:${entry.count}\r\n:${entry.reset - time}\r\n`);
      }
    });
  };
  const server = tlsOptions ? tls.createServer(tlsOptions, onConnection) : net.createServer(onConnection);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    url: `${tlsOptions ? 'rediss' : 'redis'}://:synthetic-private-redis-secret@127.0.0.1:${server.address().port}`,
    counters, commands,
    get connections() { return connections; },
    advance: ms => { time += ms; },
    setMode: value => { mode = value; },
    dropConnections: () => { for (const socket of sockets) socket.destroy(); },
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

function parseCommand(buffer) {
  let position = buffer.indexOf('\r\n');
  if (position < 0) return;
  const count = Number(buffer.subarray(1, position).toString());
  position += 2;
  const args = [];
  for (let i = 0; i < count; i += 1) {
    const end = buffer.indexOf('\r\n', position);
    if (end < 0) return;
    const length = Number(buffer.subarray(position + 1, end).toString());
    position = end + 2;
    if (buffer.length < position + length + 2) return;
    args.push(buffer.subarray(position, position + length).toString());
    position += length + 2;
  }
  return { args, bytes: position };
}

import crypto from 'node:crypto';
import { URL } from 'node:url';

const websocketGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function createRealtimeHub() {
  const driverSockets = new Map();
  const adminSockets = new Set();

  function attach(server) {
    server.on('upgrade', (req, socket) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname !== '/api/socket') {
        socket.destroy();
        return;
      }

      const key = req.headers['sec-websocket-key'];
      if (typeof key !== 'string') {
        socket.destroy();
        return;
      }

      const accept = crypto.createHash('sha1').update(`${key}${websocketGuid}`).digest('base64');
      socket.write(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${accept}`,
          '',
          ''
        ].join('\r\n')
      );

      const role = url.searchParams.get('role');
      const driverId = url.searchParams.get('driverId');

      if (role === 'driver' && driverId) {
        addMapSet(driverSockets, driverId, socket);
      }
      if (role === 'admin') {
        adminSockets.add(socket);
      }

      socket.on('close', () => {
        if (driverId) {
          removeMapSet(driverSockets, driverId, socket);
        }
        adminSockets.delete(socket);
      });
      socket.on('error', () => {
        socket.destroy();
      });
    });
  }

  function notifyDriver(driverId, event, payload) {
    const sockets = driverSockets.get(driverId) ?? new Set();
    for (const socket of sockets) {
      sendFrame(socket, JSON.stringify({ event, payload }));
    }
  }

  function notifyAdmins(event, payload) {
    for (const socket of adminSockets) {
      sendFrame(socket, JSON.stringify({ event, payload }));
    }
  }

  return {
    attach,
    notifyDriver,
    notifyAdmins
  };
}

function addMapSet(map, key, value) {
  const set = map.get(key) ?? new Set();
  set.add(value);
  map.set(key, set);
}

function removeMapSet(map, key, value) {
  const set = map.get(key);
  if (!set) {
    return;
  }
  set.delete(value);
  if (set.size === 0) {
    map.delete(key);
  }
}

function sendFrame(socket, message) {
  if (socket.destroyed) {
    return;
  }

  const payload = Buffer.from(message);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

export async function sendExpoPush(pushToken, title, body, data = {}) {
  if (!pushToken) {
    return;
  }

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data
      })
    });
  } catch {
    // Push delivery should not fail booking creation.
  }
}

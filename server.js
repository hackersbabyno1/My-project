ed');
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.on('upgrade', (req, socket, head) => {
  const pathUrl = (req.url || '').split('?')[0];
  if (!['/vless', '/vmess', '/ssh'].includes(pathUrl)) {
    socket.destroy();
    return;
  }
  if (typeof checkAndAutoRegenerateKeys === 'function') {
    checkAndAutoRegenerateKeys();
  }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n\r\n'
  );

  if (pathUrl === '/ssh') {
    socket.once('data', (chunk) => {
      if (!chunk || chunk.length === 0) return socket.destroy();
      const targetHost = process.env.SSH_TARGET_HOST || '127.0.0.1';
      const targetPort = Number(process.env.SSH_TARGET_PORT || 22);
      const remoteSocket = net.connect(targetPort, targetHost, () => {
        remoteSocket.write(chunk);
        socket.pipe(remoteSocket);
        remoteSocket.pipe(socket);
      });
      remoteSocket.on('error', () => socket.destroy());
      socket.on('error', () => remoteSocket.destroy());
    });
    return;
  }

  socket.once('data', (chunk) => {
    if (!chunk || chunk.length < 24) return socket.destroy();
    const clientUuidHex = chunk.slice(1, 17).toString('hex');
    const formattedUuid = [
      clientUuidHex.slice(0,8), clientUuidHex.slice(8,12),
      clientUuidHex.slice(12,16), clientUuidHex.slice(16,20),
      clientUuidHex.slice(20)
    ].join('-');

    const userKey = KEYS.find(k => k.uuid === formattedUuid && k.active);
    if (!userKey) return socket.destroy();
    if (userKey.id !== 1 && userKey.expiresAt < Date.now()) return socket.destroy();

    let i = 17 + 1 + (chunk[17] || 0) + 1;
    if (i + 3 > chunk.length) return socket.destroy();
    const port = chunk.readUInt16BE(i);
    i += 2;
    const ATYP = chunk[i++];
    let host = '';
    if (ATYP === 1) {
      if (i + 4 > chunk.length) return socket.destroy();
      host = chunk.slice(i, i + 4).join('.');
      i += 4;
    } else if (ATYP === 2) {
      const len = chunk[i++];
      if (i + len > chunk.length) return socket.destroy();
      host = chunk.slice(i, i + len).toString();
      i += len;
    } else if (ATYP === 3) {
      if (i + 16 > chunk.length) return socket.destroy();
      host = chunk.slice(i, i + 16).reduce((s, b, idx) => s + (idx % 2 === 0 && idx > 0 ? ':' : '') + b.toString(16).padStart(2, '0'), '');
      i += 16;
    } else {
      return socket.destroy();
    }

    const remoteSocket = net.connect(port, host, () => {
      const rawData = chunk.slice(i);
      if (rawData.length > 0) remoteSocket.write(rawData);
      socket.pipe(remoteSocket);
      remoteSocket.pipe(socket);
    });
    remoteSocket.on('error', () => socket.destroy());
    socket.on('error', () => remoteSocket.destroy());
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Mega Online Store listening on port ' + PORT);
});
// Hipp Pool: сервер комнат. Раздаёт игру и пересылает сообщения между двумя игроками комнаты.
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
 
const app = express();
const srv = http.createServer(app);
const io = new Server(srv, { maxHttpBufferSize: 8192 });
 
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
 
const rooms = new Map(); // код комнаты -> Set из id сокетов (не более 2)
 
io.on('connection', (s) => {
  let room = null;
  let tokens = 60, last = Date.now();
 
  s.on('join', (name) => {
    const code = String(name || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (!code || room) return;
    const set = rooms.get(code) || new Set();
    if (set.size >= 2) { s.emit('full'); return; }
    set.add(s.id);
    rooms.set(code, set);
    room = code;
    s.join(code);
    s.emit('joined', set.size);
  });
 
  s.on('hp', (d) => {
    if (!room) return;
    const now = Date.now();
    tokens = Math.min(60, tokens + ((now - last) / 1000) * 40);
    last = now;
    if (tokens < 1) return;            // защита от флуда
    tokens -= 1;
    let size = 0;
    try { size = JSON.stringify(d).length; } catch { return; }
    if (size > 4096) return;
    s.to(room).emit('hp', d);
  });
 
  s.on('disconnect', () => {
    if (!room) return;
    const set = rooms.get(room);
    if (set) { set.delete(s.id); if (!set.size) rooms.delete(room); }
    s.to(room).emit('hp', { t: 'bye' });
  });
});
 
const PORT = process.env.PORT || 3000;
srv.listen(PORT, () => console.log('Hipp Pool: http://localhost:' + PORT));

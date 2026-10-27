const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, pingInterval: 25000, pingTimeout: 20000 });
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
const rooms = new Map();
const MAX_PLAYERS = 6;
const characters = [
  { name: 'Captain Chutney', emoji: '🤵' }, { name: 'Madam Megaphone', emoji: '👩‍💼' },
  { name: 'Uncle U-Turn', emoji: '🧔' }, { name: 'Minister Meme', emoji: '🧑‍💼' },
  { name: 'Sir Samosa', emoji: '👨‍💼' }, { name: 'Queen Quarrel', emoji: '👩‍⚖️' }
];
function cleanName(value) { return String(value || 'Anonymous').replace(/[<>]/g, '').trim().slice(0, 18) || 'Anonymous'; }
function cleanCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); }
function publicRoom(room) {
  return { code: room.code, status: room.status, players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, emoji: p.emoji, x: p.x, hp: p.hp, alive: p.alive, score: p.score, shakti: p.shakti || 0, air: p.air, facing: p.facing, grabbedBy: p.grabbedBy })) };
}
function broadcast(room) { io.to(room.code).emit('state', publicRoom(room)); }
function announce(room, message) { io.to(room.code).emit('notice', message); }
function makeRoom(code) { const room = { code, status: 'lobby', players: new Map(), createdAt: Date.now(), endsAt: 0, timer: null }; rooms.set(code, room); return room; }
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (room) {
    room.players.delete(socket.id);
    socket.leave(code);
    if (!room.players.size) { clearTimeout(room.timer); rooms.delete(code); }
    else { if (room.status === 'fight' && [...room.players.values()].filter(p => p.alive).length <= 1) finish(room); broadcast(room); announce(room, `${socket.data.playerName || 'A player'} left the room.`); }
  }
  socket.data.roomCode = null;
}
function finish(room) { if (room.status !== 'fight') return; room.status = 'finished'; clearTimeout(room.timer); const alive = [...room.players.values()].filter(p => p.alive); const winner = alive.sort((a,b) => b.hp-a.hp)[0]; announce(room, winner ? `🏆 ${winner.name} wins the microphone!` : '🤝 It is a political draw!'); broadcast(room); }
function resetRoom(room) { room.status = 'lobby'; room.endsAt = 0; [...room.players.values()].forEach((p,i) => { p.x = 10 + i * (80 / Math.max(1, room.players.size - 1)); p.hp = 100; p.alive = true; p.score = 0; p.shakti = 0; p.air = 0; p.vy = 0; p.grabbedBy = null; p.facing = 1; }); broadcast(room); }
io.on('connection', socket => {
  socket.on('createRoom', ({ name, code, characterIndex } = {}, cb = () => {}) => {
    leaveRoom(socket);
    let roomCode = cleanCode(code) || Math.random().toString(36).slice(2, 8).toUpperCase();
    if (rooms.has(roomCode)) return cb({ ok: false, error: 'That room code already exists. Try Join Room or choose another code.' });
    const room = makeRoom(roomCode); const ci = Math.max(0, Math.min(characters.length - 1, Number(characterIndex) || 0)); const c = characters[ci];
    const p = { id: socket.id, name: cleanName(name), emoji: c.emoji, character: c.name, x: 50, hp: 100, alive: true, score: 0, shakti: 0, air: 0, vy: 0, facing: 1, grabbedBy: null, grabTarget: null, lastAction: 0 };
    room.players.set(socket.id, p); socket.join(roomCode); socket.data.roomCode = roomCode; socket.data.playerName = p.name;
    cb({ ok: true, room: publicRoom(room), playerId: socket.id }); broadcast(room); announce(room, `${p.name} created room ${roomCode}. Share the code with friends!`);
  });
  socket.on('joinRoom', ({ name, code, characterIndex } = {}, cb = () => {}) => {
    leaveRoom(socket);
    const roomCode = cleanCode(code); const room = rooms.get(roomCode);
    if (!room) return cb({ ok: false, error: 'Room not found. Check the code or create a room.' });
    if (room.players.size >= MAX_PLAYERS) return cb({ ok: false, error: 'This room is full (maximum 6 players).' });
    if (room.status === 'fight') return cb({ ok: false, error: 'The match has started. Join after this round.' });
    const i = room.players.size, ci = Math.max(0, Math.min(characters.length - 1, Number(characterIndex) || i)); const c = characters[ci];
    const p = { id: socket.id, name: cleanName(name), emoji: c.emoji, character: c.name, x: 10 + i * (80 / Math.max(1, MAX_PLAYERS - 1)), hp: 100, alive: true, score: 0, shakti: 0, air: 0, vy: 0, facing: 1, grabbedBy: null, grabTarget: null, lastAction: 0 };
    room.players.set(socket.id, p); socket.join(roomCode); socket.data.roomCode = roomCode; socket.data.playerName = p.name;
    cb({ ok: true, room: publicRoom(room), playerId: socket.id }); broadcast(room); announce(room, `${p.name} joined the room (${room.players.size}/${MAX_PLAYERS}).`);
  });
  socket.on('startFight', cb => { const room = rooms.get(socket.data.roomCode); if (!room) return cb?.({ ok:false, error:'Join a room first.' }); if (room.players.size < 2) return cb?.({ ok:false, error:'Invite at least one friend to start.' }); if (room.status === 'fight') return cb?.({ok:false,error:'The fight is already running.'}); resetRoom(room); room.status = 'fight'; room.endsAt = Date.now() + 90000; broadcast(room); announce(room, '🥊 FIGHT! Grab the microphone and try not to trip over your manifesto.'); clearTimeout(room.timer); room.timer = setTimeout(() => finish(room), 90000); cb?.({ok:true}); });
  socket.on('action', ({ action, dx } = {}) => {
    const room = rooms.get(socket.data.roomCode); if (!room || room.status !== 'fight') return;
    const p = room.players.get(socket.id); if (!p || !p.alive || p.grabbedBy) return;
    const now = Date.now(); if (now - p.lastAction < 130) return; p.lastAction = now;
    const allowed = ['left','right','jump','climb','punch','kick','grab','drag','debate','super','release']; if (!allowed.includes(action)) return;
    const alive = [...room.players.values()].filter(o => o.alive && o.id !== p.id);
    const nearest = alive.reduce((best,o) => Math.abs(o.x-p.x) < (best ? Math.abs(best.x-p.x) : Infinity) ? o : best, null);
    if (action === 'left' || action === 'right') { const dir = action === 'left' ? -1 : 1; p.x = Math.max(3, Math.min(97, p.x + dir * 3.2)); p.facing = dir; }
    if (action === 'jump') { if (p.air === 0) { p.air = 1; p.vy = 9; } }
    if (action === 'climb') { p.air = Math.min(90, p.air + 18); p.vy = 0; }
    if (action === 'release') { for (const o of room.players.values()) if (o.grabbedBy === p.id) o.grabbedBy = null; p.grabTarget = null; }
    if (['punch','kick','grab','drag','debate','super'].includes(action)) {
      const reach = action === 'super' ? 29 : action === 'debate' ? 24 : action === 'kick' ? 17 : 13;
      if (!nearest || Math.abs(nearest.x-p.x) > reach) { socket.emit('notice', 'Too far away! Move closer to your opponent.'); }
      else if (action === 'grab') { nearest.grabbedBy = p.id; p.grabTarget = nearest.id; announce(room, `🤝 ${p.name} grabbed ${nearest.name}!`); }
      else if (action === 'drag') { const target = [...room.players.values()].find(o => o.id === p.grabTarget && o.grabbedBy === p.id && o.alive); if (target) { target.x = Math.max(3, Math.min(97, p.x + p.facing * 9)); announce(room, `🪝 ${p.name} dragged ${target.name} across the arena!`); } else socket.emit('notice','Grab someone first, then drag them.'); }
      else if (action === 'super' && (p.shakti || 0) < 100) { socket.emit('notice', '⚡ Shakti meter needs to reach 100 before Super can be used.'); }
      else { const damage = action === 'super' ? 30 : action === 'punch' ? 10 : action === 'kick' ? 16 : 8; if(action === 'super') p.shakti = 0; else p.shakti = Math.min(100,(p.shakti||0)+(action==='punch'?20:action==='kick'?25:action==='debate'?12:0)); nearest.hp = Math.max(0, nearest.hp-damage); p.score += action === 'debate' ? 2 : action === 'super' ? 4 : 1; announce(room, action === 'debate' ? `📣 ${p.name} delivered a painfully long debate to ${nearest.name}!` : action === 'super' ? `⚡ SUPER MOVE! ${p.name} unleashed maximum manifesto power on ${nearest.name} (-${damage} HP)!` : `${action === 'punch' ? '👊 POW' : '🦵 KER-POW'}! ${p.name} hit ${nearest.name} (-${damage} HP).`); if (nearest.hp <= 0) { nearest.alive = false; nearest.grabbedBy = null; p.score += 10; announce(room, `💥 ${nearest.name} has been voted out of the arena!`); if ([...room.players.values()].filter(o=>o.alive).length <= 1) finish(room); } }
    }
    // Keep airborne movement deterministic and server-authoritative.
    for (const o of room.players.values()) { if (o.air > 0) { o.air = Math.max(0, o.air + o.vy); o.vy -= 1.6; if (o.air === 0) o.vy = 0; } }
    broadcast(room);
  });
  socket.on('resetRoom', cb => { const room = rooms.get(socket.data.roomCode); if (!room) return cb?.({ok:false}); clearTimeout(room.timer); resetRoom(room); announce(room,'🔁 Arena reset. Ready for another round?'); cb?.({ok:true}); });
  socket.on('disconnect', () => leaveRoom(socket));
});
server.listen(PORT, '0.0.0.0', () => console.log(`Politician Brawl listening on ${PORT}`));

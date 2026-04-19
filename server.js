const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

// База данных в памяти
let users = []; // {username, password}
let posts = [];
let stories = [];

app.get('/api/posts', (req, res) => res.json(posts));
app.get('/api/stories', (req, res) => res.json(stories));

// --- СИСТЕМА АККАУНТОВ ---
app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Заполните все поля" });
    if (users.find(u => u.username === username)) return res.status(400).json({ error: "Имя занято" });
    
    users.push({ username, password });
    res.json({ success: true });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(400).json({ error: "Неверный логин или пароль" });
    res.json({ success: true, username: user.username });
});

// --- УДАЛЕНИЕ КОНТЕНТА (Только для админа) ---
app.post('/delete-post', (req, res) => {
    const { username, postId } = req.body;
    if (username !== 'admin') return res.status(403).json({ error: "Только админ может удалять" });

    posts = posts.filter((_, index) => index !== postId);
    io.emit('refresh-content'); // Сигнал всем обновить ленту
    res.json({ success: true });
});

// Загрузка контента
app.post('/upload', (req, res) => {
    try {
        const { username, text, file, type } = req.body;
        const data = {
            username,
            text: text || '',
            file: file || null,
            type: type,
            date: new Date().toLocaleString()
        };

        if (data.type === 'story') {
            stories.unshift(data);
            if (stories.length > 20) stories.pop();
            io.emit('new-story', data);
        } else {
            posts.unshift(data);
            io.emit('new-post', data);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

io.on('connection', (socket) => {
    socket.on('message', (msg) => { io.emit('message', msg); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

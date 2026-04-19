const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

// Разрешаем серверу принимать JSON-данные
app.use(express.json());
app.use(express.static('public'));

let posts = [];
let stories = [];

// API для получения данных
app.get('/api/posts', (req, res) => res.json(posts));
app.get('/api/stories', (req, res) => res.json(stories));

// Принимаем только ссылку на файл и текст
app.post('/upload', (req, res) => {
    try {
        const data = {
            username: req.body.username || 'Аноним',
            text: req.body.text || '',
            file: req.body.file || null, // Здесь уже будет ссылка из облака
            type: req.body.type,
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
    socket.on('message', (msg) => {
        io.emit('message', msg); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

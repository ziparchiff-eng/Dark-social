const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

let posts = [];
let stories = [];

app.get('/api/posts', (req, res) => res.json(posts));
app.get('/api/stories', (req, res) => res.json(stories));

app.post('/upload', (req, res) => {
    try {
        const { username, text, file, type } = req.body;
        const data = {
            username: username || 'Аноним',
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
    socket.on('message', (msg) => {
        io.emit('message', msg); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

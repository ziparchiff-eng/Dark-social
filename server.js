const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);

// !!! ВАЖНО: Настройка CORS для работы между разными устройствами !!!
const io = socketio(server, {
    cors: {
        origin: "*", // Разрешить подключения с любых адресов (телефонов, ПК)
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

let posts = [];
let stories = [];

app.get('/api/posts', (req, res) => res.json(posts));
app.get('/api/stories', (req, res) => res.json(stories));

app.post('/upload', upload.single('file'), (req, res) => {
    const data = {
        username: req.body.username || 'Аноним',
        text: req.body.text,
        file: req.file ? `/uploads/${req.file.filename}` : null,
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
});

io.on('connection', (socket) => {
    console.log('Новое устройство подключилось!');
    
    socket.on('message', (msg) => {
        console.log('Сообщение получено:', msg);
        io.emit('message', msg); // Рассылка всем устройствам
    });

    socket.on('disconnect', () => {
        console.log('Устройство отключилось');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running: http://localhost:${PORT}`));

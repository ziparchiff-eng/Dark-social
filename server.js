const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

// --- ВСТАВЬ СВОИ КЛЮЧИ ТУТ ---
cloudinary.config({ 
  cloud_name: 'dyefptrpj', 
  api_key: '682366164847197', 
  api_secret: 'ImU_sE0CafscgQDGnKEOANmC8so' 
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  folder: 'dark_social',
  allowed_formats: ['jpg', 'png', 'jpeg', 'mp4', 'mov', 'gif', 'webm'],
  params: {
    folder: 'dark_social',
    resource_type: 'auto', // Чтобы видео грузились без ошибок
  },
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.json());

let posts = [];
let stories = [];

app.get('/api/posts', (req, res) => res.json(posts));
app.get('/api/stories', (req, res) => res.json(stories));

app.post('/upload', upload.single('file'), (req, res) => {
    try {
        const data = {
            username: req.body.username || 'Аноним',
            text: req.body.text || '',
            file: req.file ? req.file.path : null,
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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

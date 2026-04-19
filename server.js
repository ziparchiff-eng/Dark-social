const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

// --- НАСТРОЙКИ CLOUDINARY ---
cloudinary.config({ 
  cloud_name: 'dyefptrpj', 
  api_key: '682366164847197', 
  api_secret: 'ImU_sE0CafscgQDGnKEOANmC8so' 
});

// Улучшенная настройка хранилища
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  folder: 'dark_social',
  allowed_formats: ['jpg', 'png', 'jpeg', 'mp4', 'mov', 'gif', 'webm'], // Добавил больше форматов
});
const upload = multer({ storage: storage });

app.use(express.static('public'));

let posts = [];
let stories = [];

app.get('/api/posts', (req, res) => res.json(posts));
app.get('/api/stories', (req, res) => res.json(stories));

app.post('/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error("❌ ОШИБКА MULTER/CLOUDINARY:", err);
            return res.status(500).json({ success: false, error: err.message });
        }

        try {
            const data = {
                username: req.body.username || 'Аноним',
                text: req.body.text,
                file: req.file ? req.file.path : null,
                type: req.body.type,
                date: new Date().toLocaleString()
            };

            console.log("✅ Файл успешно загружен в облако:", data.file);

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
            console.error("❌ ОШИБКА ПРИ СОХРАНЕНИИ ПОСТА:", e);
            res.status(500).json({ success: false, error: e.message });
        }
    });
});

io.on('connection', (socket) => {
    socket.on('message', (msg) => {
        io.emit('message', msg); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

// --- НАСТРОЙКА МОНГОДБ (Вставь свою ссылку из Atlas!) ---
const MONGO_URI = 'mongodb+srv://admin:<Wdf31-dd>@cluster0.jfibkwu.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Схемы данных
const UserSchema = new mongoose.Schema({ username: { type: String, unique: true }, password: { type: String } });
const ContentSchema = new mongoose.Schema({
    username: String,
    text: String,
    file: String,
    type: String, // 'post' or 'story'
    date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Content = mongoose.model('Content', ContentSchema);

app.get('/api/posts', async (req, res) => {
    const posts = await Content.find({ type: 'post' }).sort({ date: -1 });
    res.json(posts);
});

app.get('/api/stories', async (req, res) => {
    const stories = await Content.find({ type: 'story' }).sort({ date: -1 }).limit(20);
    res.json(stories);
});

// Регистрация
app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (await User.findOne({ username })) return res.status(400).json({ error: "Имя занято" });
        await User.create({ username, password });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Ошибка регистрации" }); }
});

// Вход
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (!user) return res.status(400).json({ error: "Неверный логин или пароль" });
        res.json({ success: true, username: user.username });
    } catch (e) { res.status(500).json({ error: "Ошибка входа" }); }
});

// Удаление (Админ)
app.post('/delete-post', async (req, res) => {
    const { username, postId } = req.body;
    if (username !== 'admin') return res.status(403).json({ error: "Только админ может удалять" });
    await Content.findByIdAndDelete(postId);
    io.emit('refresh-content');
    res.json({ success: true });
});

// Загрузка контента
app.post('/upload', async (req, res) => {
    try {
        const data = req.body;
        const newContent = await Content.create({
            username: data.username,
            text: data.text,
            file: data.file,
            type: data.type,
            date: new Date()
        });
        
        if (data.type === 'story') {
            io.emit('new-story', newContent);
        } else {
            io.emit('new-post', newContent);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

io.on('connection', (socket) => {
    socket.on('message', (msg) => { io.emit('message', msg); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

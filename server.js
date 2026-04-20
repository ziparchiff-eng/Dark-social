const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

// --- МОНГОДБ (Вставь свою ссылку!) ---
const MONGO_URI = 'mongodb+srv://admin:Wdf31-dd@cluster0.jfibkwu.mongodb.net/?appName=Cluster0;
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

const UserSchema = new mongoose.Schema({ 
    username: { type: String, unique: true, required: true }, 
    password: { type: String, required: true },
    handle: { type: String, unique: true }, 
    avatar: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/1490/1490764.png' },
    bio: { type: String, default: 'Привет! Я новый пользователь.' }
});
const ContentSchema = new mongoose.Schema({
    username: String,
    text: String,
    file: String,
    type: String,
    date: { type: Date, default: Date.now },
    expiresAt: { type: Date, index: { expires: 0 } }
});

const User = mongoose.model('User', UserSchema);
const Content = mongoose.model('Content', ContentSchema);

// --- API ---
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Content.find({ type: 'post' }).sort({ date: -1 });
        res.json(posts);
    } catch (e) { res.status(500).json({ error: "Ошибка загрузки постов" }); }
});

app.get('/api/stories', async (req, res) => {
    try {
        const stories = await Content.find({ type: 'story' }).sort({ date: -1 }).limit(20);
        res.json(stories);
    } catch (e) { res.status(500).json({ error: "Ошибка загрузки историй" }); }
});

app.get('/api/user-info', async (req, res) => {
    try {
        const { q } = req.query;
        const user = await User.findOne({ $or: [{ handle: q }, { username: q }] });
        if (!user) return res.status(404).json({ error: "Пользователь не найден" });
        const posts = await Content.find({ username: user.username, type: 'post' }).sort({ date: -1 });
        res.json({ user, posts });
    } catch (e) { res.status(500).json({ error: "Ошибка сервера" }); }
});

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        const users = await User.find({ $or: [{ handle: new RegExp(query, 'i') }, { username: new RegExp(query, 'i') }] }).limit(10);
        res.json(users);
    } catch (e) { res.status(500).json({ error: "Ошибка поиска" }); }
});

app.post('/api/user/update', async (req, res) => {
    try {
        const { username, avatar, bio, handle } = req.body;
        const updateData = {};
        if (avatar) updateData.avatar = avatar;
        if (bio !== undefined) updateData.bio = bio;
        if (handle) updateData.handle = handle;
        const updatedUser = await User.findOneAndUpdate({ username }, updateData, { new: true });
        res.json({ success: true, user: updatedUser });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (await User.findOne({ username })) return res.status(400).json({ error: "Имя занято" });
        const handle = username.toLowerCase().replace(/\s+/g, '_') + Math.floor(Math.random() * 1000);
        await User.create({ username, password, handle });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Ошибка регистрации" }); }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (!user) return res.status(400).json({ error: "Неверный логин или пароль" });
        res.json({ success: true, username: user.username });
    } catch (e) { res.status(500).json({ error: "Ошибка входа" }); }
});

// --- МАССОВОЕ УДАЛЕНИЕ (Исправлено) ---
app.post('/api/admin/delete-all', async (req, res) => {
    if (req.body.username !== 'admin') return res.status(403).json({ error: "Доступ запрещен" });
    await Content.deleteMany({});
    io.emit('refresh-content');
    res.json({ success: true });
});

app.post('/api/admin/delete-user', async (req, res) => {
    if (req.body.username !== 'admin') return res.status(403).json({ error: "Доступ запрещен" });
    const { targetUser } = req.body;
    await Content.deleteMany({ username: targetUser });
    io.emit('refresh-content');
    res.json({ success: true });
});

app.post('/api/admin/delete-selected', async (req, res) => {
    if (req.body.username !== 'admin') return res.status(403).json({ error: "Доступ запрещен" });
    const { ids } = req.body;
    await Content.deleteMany({ _id: { $in: ids } });
    io.emit('refresh-content');
    res.json({ success: true });
});

app.post('/delete-post', async (req, res) => {
    const { username, postId } = req.body;
    if (username !== 'admin') return res.status(403).json({ error: "Только админ" });
    await Content.findByIdAndDelete(postId);
    io.emit('refresh-content');
    res.json({ success: true });
});

app.post('/upload', async (req, res) => {
    try {
        const { username, text, file, type } = req.body;
        const newContent = await Content.create({ username, text, file, type });
        if (type === 'story') io.emit('new-story', newContent); else io.emit('new-post', newContent);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

io.on('connection', (socket) => {
    socket.on('message', (msg) => { io.emit('message', msg); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

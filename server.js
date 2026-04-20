const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

// --- МОНГОДБ ---
const MONGO_URI = 'mongodb+srv://admin:Wdf31-dd@cluster0.jfibkwu.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// Схемы данных
const UserSchema = new mongoose.Schema({ username: { type: String, unique: true }, password: { type: String } });
const ContentSchema = new mongoose.Schema({
    username: String,
    text: String,
    file: String,
    type: String,
    date: { type: Date, default: Date.now },
    expiresAt: { type: Date, index: { expires: 0 } } // TTL Индекс: MongoDB удалит документ в это время
});
const ConfigSchema = new mongoose.Schema({ key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed });

const User = mongoose.model('User', UserSchema);
const Content = mongoose.model('Content', ContentSchema);
const Config = mongoose.model('Config', ConfigSchema);

// Хранилище времени последних сообщений (для анти-спама)
const chatCooldowns = new Map();

// --- API ---
app.get('/api/posts', async (req, res) => {
    const posts = await Content.find({ type: 'post' }).sort({ date: -1 });
    res.json(posts);
});

app.get('/api/stories', async (req, res) => {
    const stories = await Content.find({ type: 'story' }).sort({ date: -1 }).limit(20);
    res.json(stories);
});

// Получение настроек сервера
app.get('/api/config', async (req, res) => {
    const settings = await Config.find();
    res.json(settings);
});

// Обновление настроек (Только для админа)
app.post('/api/config', async (req, res) => {
    const { username, key, value } = req.body;
    if (username !== 'admin') return res.status(403).json({ error: "Только админ" });
    await Config.findOneAndUpdate({ key }, { value }, { upsert: true });
    res.json({ success: true });
});

app.post('/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (await User.findOne({ username })) return res.status(400).json({ error: "Имя занято" });
        await User.create({ username, password });
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
        
        // Расчет времени удаления
        const config = await Config.findOne({ key: 'expiryTime' });
        let expiresAt = null;
        if (config && config.value !== 'forever') {
            const hours = parseInt(config.value);
            expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        }

        const newContent = await Content.create({
            username, text, file, type, expiresAt
        });
        
        if (type === 'story') {
            io.emit('new-story', newContent);
        } else {
            io.emit('new-post', newContent);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

io.on('connection', (socket) => {
    socket.on('message', async (msg) => {
        const now = Date.now();
        const lastTime = chatCooldowns.get(msg.user) || 0;
        
        // Получаем лимит из конфига (по умолчанию 5 секунд)
        const config = await Config.findOne({ key: 'chatLimit' });
        const limit = config ? config.value * 1000 : 5000;

        if (now - lastTime < limit) {
            socket.emit('error-msg', { text: `Подождите еще ${Math.ceil((limit - (now - lastTime))/1000)} сек.` });
            return;
        }

        chatCooldowns.set(msg.user, now);
        io.emit('message', msg); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

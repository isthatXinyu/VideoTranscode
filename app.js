const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const cookieParser = require('cookie-parser'); // JWT token

require('dotenv').config();

const app = express();
const PORT = process.env.PORT;
const DOMAIN = process.env.DOMAIN || 'http://localhost';
// const PORT = process.env.PORT || 3000;
console.log(process.env);
console.log(process.env.PORT);
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }  // Secure cookie in production
}));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/upload', express.static(path.join(__dirname, 'uploads')));  // All upload-related routes


// Set EJS as the view engine
app.set('view engine', 'ejs');

// MongoDB connection using Mongoose
// develped with guidance of mongodb.com
mongoose.connect(process.env.MONGODB_URL, {
    //useNewUrlParser: true,
    //useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB via Mongoose'))
.catch(err => console.error('Failed to connect to MongoDB', err));

app.get('/', (req, res) => {
    res.render('index');
});

// 路由挂载（只挂载一次）
app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Update the app to log the correct domain and port
app.listen(PORT, () => {
    console.log(`${DOMAIN}:${PORT}`)
});

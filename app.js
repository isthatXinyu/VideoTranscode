const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const cookieParser = require('cookie-parser'); // JWT token
require('dotenv').config();

// Load environment variables from .env
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
// const PORT = process.env.PORT || 3000;

// MongoDB connection using Mongoose
// develped with guidance of mongodb.com
mongoose.connect('mongodb+srv://xinyuqian1231:drcNf24jIcvctrrX@cluster0.tfta3j2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    //useNewUrlParser: true,
    //useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB via Mongoose'))
.catch(err => console.error('Failed to connect to MongoDB', err));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/auth', authRoutes);  // All authentication routes (signup, login, etc.)
app.use('/upload', uploadRoutes);  // All upload-related routes


// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }  // Set to true if using HTTPS
}));

// Routes
app.use('/', authRoutes);
app.use('/', uploadRoutes);

// Change this to reflect your domain
const DOMAIN = 'http://n10366687.cab432.com';

// Update the app to log the correct domain and port
app.listen(PORT, () => {
    console.log(`Server is running on ${DOMAIN}:${PORT}`);
});
// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
// });

const express = require('express');
const router = express.Router();

// Hard-coded users for simplicity
const users = {
    'user1': 'password1',
    'user2': 'password2'
};

// Login route
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (users[username] && users[username] === password) {
        req.session.user = username;  // Save the user session
        res.redirect('/upload.html');  // Redirect to the upload page
    } else {
        res.render('index', { errorMessage: 'Incorrect password. Please try again.' });  // Render with error message
    }
});

// Render login page (without error)
router.get('/', (req, res) => {
    res.render('index', { errorMessage: null });  // Render without error message
});

module.exports = router;

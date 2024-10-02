const express = require('express');
const Cognito = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require('aws-jwt-verify');
const router = express.Router();

// AWS Cognito Configuration
const userPoolId = "ap-southeast-2_OwwgSoxlq";  // Obtain from AWS console
const clientId = "67td6j955j7dth39u7eg4ekbed";  // Obtain from AWS console
const region = "ap-southeast-2";  // Set your region
const cognitoClient = new Cognito.CognitoIdentityProviderClient({ region });

// JWT Verifiers
const accessVerifier = jwt.CognitoJwtVerifier.create({
    userPoolId: userPoolId,
    tokenUse: "access",
    clientId: clientId,
});

const idVerifier = jwt.CognitoJwtVerifier.create({
    userPoolId: userPoolId,
    tokenUse: "id",
    clientId: clientId,
});

// Sign-up Route
router.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;

    const signUpCommand = new Cognito.SignUpCommand({
        ClientId: clientId,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
    });

    try {
        const signUpResponse = await cognitoClient.send(signUpCommand);
        res.redirect('/confirm');  // Redirect user to the email confirmation page
    } catch (err) {
        console.error('Sign-up failed', err);
        res.render('signup', { errorMessage: 'Sign-up failed. Please try again.' });
    }
});


// Email Confirmation Route
router.post('/confirm', async (req, res) => {
    const { username, confirmationCode } = req.body;

    const confirmSignUpCommand = new Cognito.ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: confirmationCode,
    });

    try {
        const confirmResponse = await cognitoClient.send(confirmSignUpCommand);
        res.redirect('/login'); // Redirect user to login page after confirmation
    } catch (err) {
        console.error('Confirmation failed', err);
        res.render('confirm', { errorMessage: 'Confirmation failed. Please try again.' });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const loginCommand = new Cognito.InitiateAuthCommand({
        AuthFlow: Cognito.AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
        },
        ClientId: clientId,
    });

    try {
        const loginResponse = await cognitoClient.send(loginCommand);
        const accessToken = await accessVerifier.verify(loginResponse.AuthenticationResult.AccessToken);
        const idToken = await idVerifier.verify(loginResponse.AuthenticationResult.IdToken);

        // Generate JWT token
        const token = jwt.sign({ username }, jwtSecret, { expiresIn: '1h' });

        // Store JWT in cookie or send it as a response
        res.cookie('token', token, { httpOnly: true }); // Use cookies or send token in response
        res.redirect('/upload.html');  // Redirect to upload page
    } catch (err) {
        console.error('Login failed', err);
        res.render('login', { errorMessage: 'Login failed. Please check your username and password.' });
    }
});

// Render sign-up form
router.get('/signup', (req, res) => {
    res.render('signup'); // Make sure signup.ejs exists in the views folder
});

// Render login form
router.get('/login', (req, res) => {
    res.render('login',{ errorMessage: null }); // Make sure login.ejs exists in the views folder
});

// Render confirmation page
router.get('/confirm', (req, res) => {
    res.render('confirm'); // Make sure confirm.ejs exists in the views folder
});
// Render login page (without error)
router.get('/', (req, res) => {
    res.render('index', { errorMessage: null });  // Render without error message
});

module.exports = router;

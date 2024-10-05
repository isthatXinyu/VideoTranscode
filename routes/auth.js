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

// Sign-up Route (no confirmation needed)
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
        // Instead of redirecting to confirm, just notify the user to contact the admin for verification
        res.send('Sign-up successful. Please contact the admin to verify your account.');
    } catch (err) {
        console.error('Sign-up failed', err);
        res.status(400).send('Sign-up failed. Please try again.');
    }
});

// Login Route (with NEW_PASSWORD_REQUIRED handling)
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

        // Handle NEW_PASSWORD_REQUIRED challenge
        if (loginResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            const session = loginResponse.Session; // Save this session for the next step
            res.render('change-password', { username, session });
        } else {
            const accessToken = loginResponse.AuthenticationResult.AccessToken;
            const idToken = loginResponse.AuthenticationResult.IdToken;

            // Store tokens in session
            req.session.accessToken = accessToken;
            req.session.idToken = idToken;

            res.redirect('/upload.html'); // Redirect after successful login
        }
    } catch (err) {
        console.error('Login failed:', err);
        res.render('login', { errorMessage: 'Login failed. Please check your username and password.' });
    }
});


// Handle new password submission
router.post('/change-password', async (req, res) => {
    const { username, newPassword, session } = req.body; // session should be passed via the form

    try {
        const respondToAuthChallengeCommand = new Cognito.RespondToAuthChallengeCommand({
            ChallengeName: 'NEW_PASSWORD_REQUIRED',
            ClientId: clientId,
            ChallengeResponses: {
                USERNAME: username,
                NEW_PASSWORD: newPassword,
            },
            Session: session // Pass the session parameter
        });

        const response = await cognitoClient.send(respondToAuthChallengeCommand);

        // If successful, redirect the user to the login page
        console.log('Password change successful:', response);
        res.redirect('/login');
    } catch (err) {
        console.error('Password change failed:', err);
        res.render('change-password', { username, session, errorMessage: 'Failed to change password. Please try again.' });
    }
});


// Render change-password form
router.get('/change-password', (req, res) => {
    const username = req.query.username;
    res.render('change-password', { username });
});

// Render login form
router.get('/login', (req, res) => {
    res.render('login', { errorMessage: null });
});

// Render index page
router.get('/', (req, res) => {
    res.render('index', { errorMessage: null });
});

module.exports = router;

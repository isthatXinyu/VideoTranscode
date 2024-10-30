const jwt = require("jsonwebtoken");

// Using a fixed authentication secret for demonstration purposes.
// Ideally this would be stored in a secrets manager and retrieved here.
// To create a new randomly chosen secret instead, you can use:
//
// tokenSecret = require("crypto").randomBytes(64).toString("hex");
//
const tokenSecret =
   "e9aae26be08551392be664d620fb422350a30349899fc254a0f37bfa1b945e36ff20d25b12025e1067f9b69e8b8f2ef0f767f6fff6279e5755668bf4bae88588";

// Create a token with username embedded, setting the validity period.
const generateAccessToken = (username) => {
   return jwt.sign(username, tokenSecret, { expiresIn: "30m" });
};

// Middleware to verify a token and respond with user information
const authenticateToken = (req, res, next) => {
   // We are using Bearer auth.  The token is in the authorization header.
   const authHeader = req.headers["authorization"];
   const token = authHeader && authHeader.split(' ')[1];

   if (!token) {
      console.log("JSON web token missing.");
      return res.sendStatus(401);
   }

   // Check that the token is valid
   try {
      const user = jwt.verify(token, tokenSecret);

      console.log(
         `authToken verified for user: ${user.username} at URL ${req.url}`
      );

      // Add user info to the request for the next handler
      req.user = user;
      next();
   } catch (err) {
      console.log(
         `JWT verification failed at URL ${req.url}`,
         err.name,
         err.message
      );
      return res.sendStatus(401);
   }
};

module.exports = { generateAccessToken, authenticateToken };

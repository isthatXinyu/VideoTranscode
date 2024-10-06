const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { Video, saveMetadataToMongo, updateVideoStatus } = require('../models/video');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName = 'n10366687-test';  
const s3Client = new S3Client({ region: 'ap-southeast-2' });

// Set up multer for file uploads (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// JWT Authentication Middleware
function authenticateJWT(req, res, next) {
    const token = req.cookies.token || req.headers.authorization;
    if (token) {
        jwt.verify(token, 'your-jwt-secret', (err, user) => {
            if (err) {
                return res.status(403).send('Forbidden');
            }
            req.user = user;
            next();
        });
    } else {
        res.status(401).send('Unauthorized');
    }
}

// Helper function to upload an object to S3
async function uploadObject(objectKey, objectValue) {
    try {
        const putObjectCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: objectValue,
        });
        const response = await s3Client.send(putObjectCommand);
        console.log('Object uploaded:', response);
        return response;
    } catch (err) {
        console.error('Error uploading object:', err);
        throw err;
    }
}

// Helper function to generate a pre-signed URL for the object in S3
async function generatePresignedUrl(objectKey) {
    try {
        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        });
        const presignedURL = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
        console.log('Pre-signed URL generated:', presignedURL);
        return presignedURL;
    } catch (err) {
        console.error('Error generating pre-signed URL:', err);
        throw err;
    }
}

// Progress tracking variable
let currentProgress = 0;

// Inside the POST /upload route after the video is saved to MongoDB, add authenticateJWT
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
      if (!req.file) {
          console.error('No file uploaded');
          return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('File uploaded:', req.file.originalname);
      console.log('File buffer size:', req.file.buffer.length);

      const format = req.body.format;
      const resolution = req.body.resolution;
      const originalFilename = req.file.originalname;
      const objectKey = `uploads/${Date.now()}_${req.file.originalname}`;

      if (!format || !resolution) {
          return res.status(400).json({ error: 'Format and resolution must be selected.' });
      }

      // Upload video buffer to S3
      const s3Response = await uploadObject(objectKey, req.file.buffer);
      console.log(`Video uploaded to S3 with key: ${objectKey}`);

      // Create a new video document in the database
      const video = new Video({
          originalFilename: originalFilename,
          s3Key: objectKey,
          format: format,
          resolution: resolution,
          status: 'processing',
      });

      const savedVideo = await video.save();
      console.log('Video document saved successfully:', savedVideo);

      // Transcode the video
      const tempPath = path.resolve(__dirname, '../uploads/', `${Date.now()}_${req.file.originalname}`);
      
      // Write video buffer to disk for transcoding
      fs.writeFileSync(tempPath, req.file.buffer);

      // Now call transcodeVideo function and handle the response
      transcodeVideo(tempPath, format, resolution, savedVideo._id, res);
  } catch (err) {
      console.error('Error in upload route:', err);
      return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Video transcoding function using ffmpeg
const { PassThrough } = require('stream');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Video transcoding function using ffmpeg
const transcodeVideo = (inputPath, format, resolution, videoId, res) => {
  const outputFilename = `${path.basename(inputPath, path.extname(inputPath))}_${resolution}p.${format}`;
  const transcodedObjectKey = `transcoded/${outputFilename}`;
  
  // Use PassThrough stream to pipe the transcoded video directly to S3
  const passThrough = new PassThrough();

  // Create the S3 client
  const s3Client = new S3Client({ region: 'ap-southeast-2' });

  // Upload the transcoded stream to S3
  const uploadToS3 = async (s3Key, stream) => {
    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: stream,
      ContentType: `video/${format}`,
    };

    try {
      const response = await s3Client.send(new PutObjectCommand(params));
      console.log(`Transcoded video uploaded to S3 with key: ${s3Key}`);
      return response;
    } catch (err) {
      console.error('Error uploading transcoded video to S3:', err);
      throw err;
    }
  };

  // Start the ffmpeg process and stream directly to S3
  ffmpeg(inputPath)
    .output(passThrough)
    .outputOptions([
      '-c:v libx264',
      `-vf scale=-2:${resolution}`,
      '-preset fast',
      '-crf 23'
    ])
    .on('start', (commandLine) => {
      console.log('FFmpeg process started with command:', commandLine);
    })
    .on('progress', (progress) => {
      currentProgress = progress.percent.toFixed(2);
      console.log(`Processing: ${currentProgress}% done`);
    })
    .on('end', async () => {
      currentProgress = 100;
      console.log('Transcoding completed.');

      try {
        // Wait for the S3 upload to complete
        await uploadToS3(transcodedObjectKey, passThrough);

        // Generate a new pre-signed URL for the transcoded video
        const transcodedPresignedUrl = await generatePresignedUrl(transcodedObjectKey);

        // Update the video document in MongoDB with the S3 key of the transcoded file
        await Video.findByIdAndUpdate(videoId, {
          transcodedFilename: outputFilename,
          s3Key: transcodedObjectKey, // Save the new S3 key for the transcoded file
          status: 'completed'
        });

        // Respond with the pre-signed URL for the transcoded file
        res.json({ presignedUrl: transcodedPresignedUrl });
      } catch (err) {
        console.error('Error uploading transcoded video to S3:', err);
        await Video.findByIdAndUpdate(videoId, { status: 'failed' });
        res.status(500).send('Error uploading transcoded video to S3.');
      }

      // Delete the original input file
      fs.unlink(inputPath, (err) => {
        if (err) console.error('Error deleting original file:', err);
        else console.log('Original file deleted.');
      });
    })
    .on('error', async (err) => {
      console.error('Error during transcoding:', err);
      await Video.findByIdAndUpdate(videoId, { status: 'failed' });
      res.status(500).send('Error during transcoding.');
    })
    .run();

  // Stream the transcoded output to S3 while tracking progress
  uploadToS3(transcodedObjectKey, passThrough);
};

// Progress tracking route for Server-Sent Events (SSE)
router.get('/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush the headers to establish SSE connection
  
    // Send progress updates every second
    const intervalId = setInterval(() => {
      res.write(`data: ${currentProgress}\n\n`); // Send the current progress
    }, 1000);
  
    req.on('close', () => {
      clearInterval(intervalId); // Stop sending progress when connection is closed
      res.end();
    });
  });
  
// Route to download the transcoded video
router.get('/download/:id', async (req, res) => {
  try {
      const video = await Video.findById(req.params.id);
      if (!video) return res.status(404).send('Video not found');

      // Use the transcoded S3 key if available, otherwise, fallback to the original video S3 key
      const s3KeyToUse = video.transcodedFilename ? video.s3Key : video.s3Key;

      // Generate a pre-signed URL for the **transcoded** video
      const presignedUrl = await generatePresignedUrl(s3KeyToUse);
      res.json({ presignedUrl });
  } catch (err) {
      console.error('Error retrieving video:', err);
      res.status(500).send('Error retrieving video');
  }
});

module.exports = router;

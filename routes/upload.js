const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Video = require('../models/video');  // video model
const router = express.Router();
const jwt = require('jsonwebtoken');
const { main } = require('../s3');  // Import the main function from s3.js

// Store file in memory
const storage = multer.memoryStorage();  

// Set up multer for file uploads
const upload = multer({ storage: storage });

let currentProgress = 0;
let outputVideo = '';
let originalVideo = '';

router.get('/progress', (req, res) => {
  res.json({ progress: currentProgress });
});

// JWT Authentication Middleware
function authenticateJWT(req, res, next) {
  const token = req.cookies.token;
  if (token) {
    jwt.verify(token, 'your-jwt-secret', (err, user) => {
      if (err) return res.sendStatus(403);  // Forbidden
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);  // Unauthorized
  }
}

// Transcoding video logic (adjust based on app logic)
const transcodeVideo = (inputPath, format, resolution, res, videoId, originalFilename) => {
  const outputFilename = `${path.basename(inputPath, path.extname(inputPath))}_${resolution}p.${format}`;
  const outputPath = path.resolve(__dirname, '../uploads/', outputFilename);

  ffmpeg(inputPath)
    .output(outputPath)
    .outputOptions([
      '-c:v libx264',
      `-vf scale=-2:${resolution}`,  // Maintain aspect ratio
      '-preset fast',
      '-crf 23',
    ])
    .on('start', (commandLine) => {
      console.log('FFmpeg process started with command:', commandLine);
    })
    .on('progress', (progress) => {
      currentProgress = progress.percent.toFixed(2);
      console.log(`Processing: ${progress.percent.toFixed(2)}% done`);
    })
    .on('end', async () => {
      currentProgress = 100;
      console.log(`Transcoding to ${format} at ${resolution}p completed.`);
      originalVideo = outputFilename;
      outputVideo = outputPath;
      // Update the video document with transcoded filename and status
      try {
        await Video.findByIdAndUpdate(videoId, {
          transcodedFilename: outputFilename,
          status: 'completed',
        });
        console.log('Video document updated successfully.');
      } catch (err) {
        console.error('Error updating video document:', err);
      }

      // Remove the original uploaded file to save space
      fs.unlink(inputPath, (err) => {
        if (err) console.error('Error deleting original file:', err);
        else console.log('Original file deleted successfully.');
      });
    })
    .on('error', async (err) => {
      console.error(`Transcoding error: ${err.message}`);
      try {
        await Video.findByIdAndUpdate(videoId, { status: 'failed' });
        console.log('Video document updated with failed status.');
      } catch (updateErr) {
        console.error('Error updating video document with failed status:', updateErr);
      }

      res.status(500).send('Error during transcoding.');
    })
    .run();
};

// Upload Route
router.post('/upload', authenticateJWT, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File uploaded:', req.file.originalname);  // Log the file name to ensure Multer is processing it
    console.log('File buffer size:', req.file.buffer.length); // Check the buffer size
  
    const format = req.body.format;
    const resolution = req.body.resolution;
    const originalFilename = req.file.originalname;

    if (!format || !resolution) {
      return res.status(400).json({ error: 'Format and resolution must be selected.' });
    }

    // Upload the original video to S3 and get a pre-signed URL
    const presignedUrl = await main(req.file);

    // Create a new video document in the database
    const video = new Video({
      originalFilename: originalFilename,
      s3Key: req.file.originalname,
      format: format,
      resolution: resolution,
      status: 'processing',
    });

    const savedVideo = await video.save();
    console.log('Video document saved successfully:', savedVideo);

    // Transcode the video
    const tempPath = path.resolve(__dirname, '../uploads/', `${Date.now()}_${req.file.originalname}`);
    
    // Write video buffer to disk for transcoding
    try {
      fs.writeFileSync(tempPath, req.file.buffer);
      console.log('Video buffer written to disk successfully.');
    } catch (fsError) {
      console.error('Error writing video to disk:', fsError);
      return res.status(500).json({ error: 'Error writing video to disk for transcoding: ' + fsError.message });
    }

    // Transcode the video
    transcodeVideo(tempPath, format, resolution, res, savedVideo._id, originalFilename);

    // Respond with the pre-signed URL
    res.json({ presignedUrl });
  } catch (err) {
    console.error('Error in upload route:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Route to download a video using the pre-signed URL
router.get('/download', authenticateJWT, async (req, res) => {
  try {
    const video = await Video.findById(req.query.videoId);  // Find the video by ID
    if (!video) {
      return res.status(404).send('Video not found.');
    }

    // Generate a pre-signed URL for downloading the transcoded file
    const presignedUrl = await generatePresignedUrl(video.s3Key);

    // Redirect to the pre-signed URL
    res.redirect(presignedUrl);
  } catch (err) {
    console.error('Error downloading the file:', err);
    res.status(500).send('Error downloading the file.');
  }
});

module.exports = router;

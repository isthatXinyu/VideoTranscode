const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Video = require('../models/video');  // Your video model
const router = express.Router();
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// S3 Configuration
const bucketName = 'n10366687-assignment';
const s3Client = new S3Client({ region: 'ap-southeast-2' });

// Store file in memory
const storage = multer.memoryStorage();  


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

// Set up multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     const uploadPath = path.resolve(__dirname, '../uploads/');
//     cb(null, uploadPath);  // Directory where files will be uploaded
//   },
//   filename: function (req, file, cb) {
//     const timestamp = Date.now();
//     const ext = path.extname(file.originalname);
//     cb(null, `${timestamp}${ext}`);  // Use a unique timestamp filename
//   },
// });

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

// Transcoding video logic (optional, adjust based on your app logic)
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

      // Update the video document with error status
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

router.post('/upload', authenticateJWT, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const format = req.body.format;
    const resolution = req.body.resolution;
    const originalFilename = req.file.originalname;
    const objectKey = `${Date.now()}_${originalFilename}`;

    if (!format || !resolution) {
      return res.status(400).send('Format and resolution must be selected.');
    }

    // Upload the original video to S3
    await uploadObject(objectKey, req.file.buffer);  // No need to read from disk

    // Generate a pre-signed URL for the uploaded video
    const presignedUrl = await generatePresignedUrl(objectKey);

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

    // Transcode the video (optional, based on your logic)
    // If needed, call the transcode function and handle progress

    // Respond with the pre-signed URL
    res.json({ presignedUrl });
  } catch (err) {
    console.error('Error in upload route:', err);
    res.status(500).send('Internal server error.');
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

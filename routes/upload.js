const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { Video, saveMetadataToMongo, updateVideoStatus } = require('../models/video');  // Correctly import Video and functions
const router = express.Router();
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName = 'n10366687-test';  
const s3Client = new S3Client({ region: 'ap-southeast-2' });

// Set up multer for file uploads (in memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

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

// Progress tracking variables
let currentProgress = 0;

// Route to handle file upload and transcoding
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
      if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('File uploaded:', req.file.originalname);
      const format = req.body.format;
      const resolution = req.body.resolution;
      const originalFilename = req.file.originalname;
      const objectKey = `uploads/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      if (!format || !resolution) {
          return res.status(400).json({ error: 'Format and resolution must be selected.' });
      }

      // Upload the video file to S3
      try {
          await uploadObject(objectKey, req.file.buffer);
          console.log('Video uploaded to S3 successfully.');
      } catch (uploadError) {
          console.error('Error uploading video to S3:', uploadError);
          return res.status(500).json({ error: 'Error uploading video to S3' });
      }

      // Generate a pre-signed URL for the uploaded video
      const presignedUrl = await generatePresignedUrl(objectKey);

      // Save video metadata to MongoDB
      const savedVideo = await saveMetadataToMongo(originalFilename, objectKey, format, resolution);
      console.log('Video document saved:', savedVideo);

      // Transcode the video logic here...

      // Send response with the pre-signed URL
      res.json({ presignedUrl });
  } catch (error) {
      console.error('Error in upload route:', error);
      res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Video transcoding function using ffmpeg
const transcodeVideo = (inputPath, format, resolution, videoId, res) => {
    const outputFilename = `${path.basename(inputPath, path.extname(inputPath))}_${resolution}p.${format}`;
    const outputPath = path.resolve(__dirname, '../uploads/', outputFilename);

    ffmpeg(inputPath)
        .output(outputPath)
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
            await Video.findByIdAndUpdate(videoId, {
                transcodedFilename: outputFilename,
                status: 'completed'
            });
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
};

// Route to get progress
router.get('/progress', (req, res) => {
    res.json({ progress: currentProgress });
});

// Route to download the transcoded video
router.get('/download/:id', async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).send('Video not found');

        const presignedUrl = await generatePresignedUrl(video.s3Key);
        res.json({ presignedUrl });
    } catch (err) {
        console.error('Error retrieving video:', err);
        res.status(500).send('Error retrieving video');
    }
});

module.exports = router;

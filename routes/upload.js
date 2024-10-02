const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const Video = require("../models/video"); // Import the Video model
const router = express.Router();
const { uploadObject, generatePresignedUrl } = require("../services/s3");

// Set up multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.resolve(__dirname, "../uploads/");
    cb(null, uploadPath); // Directory where files will be uploaded
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}${ext}`); // Use a unique timestamp filename
  },
});

function authenticateJWT(req, res, next) {
  const token = req.cookies.token;

  if (token) {
      jwt.verify(token, jwtSecret, (err, user) => {
          if (err) {
              return res.sendStatus(403);  // Forbidden
          }
          req.user = user;
          next();
      });
  } else {
      res.sendStatus(401);  // Unauthorized
  }
}

const upload = multer({ storage: storage });

let currentProgress = 0;
let outputVideo = "";
let originalVideo = "";
router.get("/progress", (req, res) => {
  res.json({ progress: currentProgress });
});

// Function to transcode video
// ffmpeg is developed under the guidance of chatgpt
const transcodeVideo = (
  inputPath,
  format,
  resolution,
  res,
  videoId,
  originalFilename
) => {
  const outputFilename = `${path.basename(
    inputPath,
    path.extname(inputPath)
  )}_${resolution}p.${format}`;
  const outputPath = path.resolve(__dirname, "../uploads/", outputFilename);

  ffmpeg(inputPath)
    .output(outputPath)
    .outputOptions([
      "-c:v libx264",
      `-vf scale=-2:${resolution}`, // Maintain aspect ratio
      "-preset fast",
      "-crf 23",
    ])
    .on("start", (commandLine) => {
      console.log("FFmpeg process started with command:", commandLine);
    })
    .on("progress", (progress) => {
      currentProgress = progress.percent.toFixed(2);
      console.log(`Processing: ${progress.percent.toFixed(2)}% done`);
    })
    .on("end", async () => {
      currentProgress = 100;
      console.log(`Transcoding to ${format} at ${resolution}p completed.`);
      originalVideo = outputFilename;
      outputVideo = outputPath;
      // Update the video document with transcoded filename and status
      try {
        await Video.findByIdAndUpdate(videoId, {
          transcodedFilename: outputFilename,
          status: "completed",
        });
        console.log("Video document updated successfully.");
      } catch (err) {
        console.error("Error updating video document:", err);
      }

      // Remove the original uploaded file to save space
      fs.unlink(inputPath, (err) => {
        if (err) console.error("Error deleting original file:", err);
        else console.log("Original file deleted successfully.");
      });
    })
    .on("error", async (err) => {
      console.error(`Transcoding error: ${err.message}`);

      // Update the video document with error status
      try {
        await Video.findByIdAndUpdate(videoId, { status: "failed" });
        console.log("Video document updated with failed status.");
      } catch (updateErr) {
        console.error(
          "Error updating video document with failed status:",
          updateErr
        );
      }

      res.status(500).send("Error during transcoding.");
    })
    .run();
};

// Upload and transcode route
// router.post('/upload', upload.single('video'), async (req, res) => {
router.post("/upload", authenticateJWT, async (req, res) => {
  // File to be uploaded
  const { file } = req.body;
  const objectKey = "your-object-key";

  try {
    // Upload the file to S3
    await uploadObject(objectKey, file);

    // Generate a pre-signed URL for the uploaded object
    const presignedUrl = await generatePresignedUrl(objectKey);
    res.send({ presignedUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Upload failed.");
  }

  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const inputPath = req.file.path;
    const format = req.body.format;
    const resolution = req.body.resolution;
    const originalFilename = req.file.originalname;

    if (!format || !resolution) {
      // Delete the uploaded file if format or resolution is missing
      fs.unlink(inputPath, (err) => {
        if (err)
          console.error("Error deleting file after missing parameters:", err);
      });
      return res.status(400).send("Format and resolution must be selected.");
    }

    // Create a new video document in the database
    const video = new Video({
      originalFilename: originalFilename,
      filePath: inputPath,
      format: format,
      resolution: resolution,
      status: "processing",
    });

    const savedVideo = await video.save();
    console.log("Video document saved successfully:", savedVideo);

    // res.json({ videoId: savedVideo._id });
    // Transcode the uploaded video into the selected format and resolution
    transcodeVideo(
      inputPath,
      format,
      resolution,
      res,
      savedVideo._id,
      originalFilename
    );
  } catch (err) {
    console.error("Error in upload route:", err);
    res.status(500).send("Internal server error.");
  }
});

router.get("/download", (req, res) => {
  // Serve the transcoded file for download
  res.download(outputVideo, originalVideo, (err) => {
    if (err) {
      console.error("Error downloading the file:", err);
      res.status(500).send("Error downloading the file.");
    } else {
      console.log("File downloaded successfully.");
    }
  });
});

module.exports = router;

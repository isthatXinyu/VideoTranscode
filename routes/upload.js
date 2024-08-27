const express = require("express");
const multer = require("multer");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const router = express.Router();

// Set up multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Directory where files will be uploaded
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Use a unique timestamp filename
  },
});

const upload = multer({ storage: storage });

// Function to transcode video
const transcodeVideo = (
  inputPath,
  format,
  resolution,
  onProgress,
  callback
) => {
  const outputPath = `uploads/${path.basename(
    inputPath,
    path.extname(inputPath)

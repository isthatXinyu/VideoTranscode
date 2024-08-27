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
  )}_${resolution}p.${format}`;

  let currentProgress = 0; // Define globally

  ffmpeg(inputPath)
    // Set output path
    .output(outputPath)
    .outputFormat(format)
    // Set video codec and size based on resolution
    .videoCodec("libx264")
    // Resize the video to the specified resolution
    .size(`${resolution}x?`)
    .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
        currentProgress = progress.percent; // Update currentProgress
    })
    // Completed transcoding
    .on('end', () => {
        console.log(`Transcoding to ${format} at ${resolution}p completed.`);
        currentProgress = 100; // Set progress to 100% upon completion
        res.send(`Video uploaded and transcoded successfully.`);
    })
    // Error handling
    .on('error', (err) => {
        console.error(`Transcoding error: ${err.message}`);
        currentProgress = 0; // Reset progress in case of error
        res.status(500).send('Error during transcoding.');
    })
    .run();
};


// SSE route to send progress updates
router.get("/progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // flush the headers to establish SSE with the client

  const interval = setInterval(() => {
    res.write(`data: ${currentProgress}\n\n`);
  }, 1000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

// Upload and transcode route
router.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const inputPath = req.file.path;
  const format = req.body.format;
  const resolution = req.body.resolution;

  if (!format || !resolution) {
    return res.status(400).send("Format and resolution must be selected.");
  }

  // Transcode the uploaded video into the selected format and resolution
  transcodeVideo(
    inputPath,
    format,
    resolution,
    (percent) => {
      currentProgress = percent;
    },
    (err, outputPath) => {
      if (err) {
        return res.status(500).send("Error during transcoding.");
      }
      currentProgress = 0; // reset progress after completion

      // Send back the link to the transcoded video
      const downloadLink = `/download/${path.basename(outputPath)}`;
      res.send(`
      Video uploaded and transcoded successfully.<br>
      <a href="/download/${path.basename(
        outputPath
      )}" download>Download Transcoded Video</a>
  `);
    }
  );
});

// Route to serve the transcoded video for download
router.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, "../uploads", filename);
  console.log(`Attempting to download: ${filepath}`); // verify the file path
  res.download(filepath, filename, (err) => {
    if (err) {
      console.error(`Error downloading file: ${err.message}`);
      res.status(500).send("Error downloading the file.");
    }
  });
});

module.exports = router;

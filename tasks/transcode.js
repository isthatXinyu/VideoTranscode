const path = require("path");
const fs = require("fs");
const { Video } = require("../models/video");
const { uploadToS3, downloadFromS3 } = require("../services/s3");
const { pollMessages, deleteMessage } = require("../services/sqs");
const ffmpeg = require("fluent-ffmpeg");

const queueUrl = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n10366687-test-queue";

const pollAndProcessMessages = async () => {
    try {
        const messages = await pollMessages(queueUrl);
        if (messages.length > 0) {
            const message = messages[0];
            const { videoId, format, resolution, s3Key } = JSON.parse(message.Body);

            console.log("Received SQS message:", message.Body);
            await processTranscodingTask(videoId, format, resolution, s3Key);

            // Delete message from SQS
            await deleteMessage(queueUrl, message.ReceiptHandle);
        } else {
            console.log("No messages in queue");
        }
    } catch (error) {
        console.error("Error polling and processing messages:", error);
    }
};

const processTranscodingTask = async (videoId, format, resolution, s3Key) => {
    try {
        // Download video from S3 to local file
        const localFilePath = path.resolve(__dirname, "../downloads/", `${Date.now()}_${path.basename(s3Key)}`);
        const transcodedFilename = `${path.basename(localFilePath, path.extname(localFilePath))}_${resolution}p.${format}`;
        const transcodedPath = path.resolve(__dirname, "../uploads/", transcodedFilename);

        await downloadFromS3("n10366687-test", s3Key, localFilePath);

        // Transcode video
        await transcodeVideo(localFilePath, transcodedPath, format, resolution);

        // Upload transcoded video to S3
        const transcodedObjectKey = `transcoded/${transcodedFilename}`;
        const transcodedFileBuffer = fs.readFileSync(transcodedPath);
        await uploadToS3("n10366687-test", transcodedObjectKey, transcodedFileBuffer);

        // Update video document in MongoDB
        await Video.findByIdAndUpdate(videoId, {
            s3Key: transcodedObjectKey,
            status: "completed"
        });

        // Cleanup local files
        fs.unlinkSync(localFilePath);
        fs.unlinkSync(transcodedPath);

        console.log(`Transcoding for video ${videoId} completed successfully.`);
    } catch (error) {
        console.error("Error processing transcoding task:", error);
        await Video.findByIdAndUpdate(videoId, { status: "failed" });
    }
};

// ffmpeg video transcoding function
const transcodeVideo = (inputPath, outputPath, format, resolution) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .output(outputPath)
            .outputOptions(["-c:v libx264", `-vf scale=-2:${resolution}`, "-preset fast", "-crf 23"])
            .on("start", (commandLine) => console.log("FFmpeg started with command:", commandLine))
            .on("end", resolve)
            .on("error", reject)
            .run();
    });
};

// Poll messages at a regular interval
setInterval(pollAndProcessMessages, 5000);

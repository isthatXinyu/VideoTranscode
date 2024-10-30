const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the video schema
const videoSchema = new Schema({
    originalFilename: String,
    transcodedFilename: String,  // Name of the transcoded file
    s3Key: String,               // S3 object key
    format: String,              // Format (e.g., mp4, avi, webm)
    resolution: String,          // Resolution (e.g., 1080p, 720p)
    status: {                    // Current status of the video (processing, completed, failed)
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    uploadDate: {                // Date of the upload
        type: Date,
        default: Date.now
    }
});

// Create Video model
const Video = mongoose.model('Video', videoSchema);

// Save video metadata to MongoDB
const saveMetadataToMongo = async (fileName, s3Key, format, resolution, status = 'processing') => {
    const video = new Video({
        originalFilename: fileName,
        s3Key: s3Key,
        format: format,
        resolution: resolution,
        status: status,
    });

    try {
        const savedVideo = await video.save();
        console.log('Video metadata saved successfully in MongoDB:', savedVideo);
        return savedVideo;  // Return the saved video document
    } catch (err) {
        console.error('Error saving video metadata to MongoDB:', err);
        throw err;
    }
};

// Update video metadata status
const updateVideoStatus = async (videoId, status) => {
    try {
        const updatedVideo = await Video.findByIdAndUpdate(videoId, { status: status }, { new: true });
        console.log(`Video status updated to ${status} for video ID: ${videoId}`);
        return updatedVideo;
    } catch (err) {
        console.error('Error updating video status:', err);
        throw err;
    }
};

// Export both the Video model and the helper functions
module.exports = { Video, saveMetadataToMongo, updateVideoStatus };

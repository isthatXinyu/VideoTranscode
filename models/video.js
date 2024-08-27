// models/video.js
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    originalFilename: { type: String, required: true },
    transcodedFilename: { type: String },
    filePath: { type: String, required: true },
    format: { type: String, required: true },
    resolution: { type: String, required: true },
    status: { type: String, default: 'pending' }, // 'pending', 'in-progress', 'completed', 'failed'
    uploadDate: { type: Date, default: Date.now }
});

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;

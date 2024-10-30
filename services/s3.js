const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

// Initialize S3 client
const s3Client = new S3Client({ region: 'ap-southeast-2' });

// Function to download a file from S3
async function downloadFromS3(bucketName, key, downloadPath) {
    const params = {
        Bucket: bucketName,
        Key: key
    };
    const command = new GetObjectCommand(params);
    try {
        const data = await s3Client.send(command);
        const fs = require('fs');
        fs.writeFileSync(downloadPath, data.Body);
        console.log(`File downloaded to ${downloadPath}`);
    } catch (err) {
        console.error("Error downloading from S3:", err);
    }
}

// Function to upload a file to S3
async function uploadToS3(bucketName, key, body) {
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: body
    };
    const command = new PutObjectCommand(params);
    try {
        await s3Client.send(command);
        console.log('File uploaded successfully');
    } catch (err) {
        console.error("Error uploading to S3:", err);
    }
}

module.exports = { s3Client, uploadToS3, downloadFromS3 };

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require('fs');

const bucketName = 'n10366687-test';
const s3Client = new S3Client({ region: 'ap-southeast-2' });

const uploadToS3 = async (s3Key, buffer) => {
    try {
        const uploadParams = {
            Bucket: bucketName,
            Key: s3Key,
            Body: buffer,
            ContentType: 'video/mp4', // Adjust based on format
        };
        const response = await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`Uploaded to S3 with key: ${s3Key}`);
        return response;
    } catch (err) {
        console.error('Error uploading to S3:', err);
        throw err;
    }
};

async function generatePresignedUrl(objectKey) {
    try {
        const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('Generated Pre-signed URL:', presignedUrl);
        return presignedUrl;
    } catch (err) {
        console.error('Error generating pre-signed URL:', err);
        throw err;
    }
}

module.exports = { uploadToS3, generatePresignedUrl };

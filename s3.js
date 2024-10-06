const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName = 'n10366687-test';
const s3Client = new S3Client({ region: 'ap-southeast-2' });

const fs = require('fs');
const uploadToS3 = async (s3Key, localFilePath) => {
    try {
        const fileStream = fs.createReadStream(localFilePath);
        const uploadParams = {
            Bucket: bucketName,
            Key: s3Key,
            Body: fileStream,
            ContentType: 'video/mp4', // or other format
        };
        const response = await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`Transcoded video uploaded to S3 with key: ${s3Key}`);
        return response;
    } catch (err) {
        console.error('Error uploading transcoded video to S3:', err);
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

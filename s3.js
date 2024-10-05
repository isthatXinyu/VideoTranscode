const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucketName = 'n10366687-test';
const s3Client = new S3Client({ region: 'ap-southeast-2' });

async function uploadToS3(objectKey, objectValue) {
    try {
        const response = await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: objectValue
        }));
        console.log('Write Response:', response);
        return response;
    } catch (err) {
        console.error('Error writing to S3:', err);
        throw err;
    }
}

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

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fetch = require('node-fetch');  // Required to use fetch with pre-signed URL

// Configuration variables
const bucketName = 'n10366687-test';  // Ensure this is the correct bucket name
const objectKey = 'myAwesomeObjectKey';  // You can modify the key for your object
const objectValue = 'This could be just about anything.';  // Replace with actual file buffer or content

// Create an S3 client (using your region, no access keys needed with IAM roles)
const s3Client = new S3Client({ region: 'ap-southeast-2' });

// Main function to handle writing, reading, and generating pre-signed URLs
async function main() {
    try {
        // Write to S3
        console.log('Writing to S3...');
        const writeResponse = await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: objectValue
        }));
        console.log('Write Response:', writeResponse);

        // Read from S3
        console.log('Reading from S3...');
        const getObjectResponse = await s3Client.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        }));
        const bodyContent = await getObjectResponse.Body.transformToString();  // Convert the body to a string
        console.log('Object content:', bodyContent);

        // Generate a pre-signed URL for reading the object
        console.log('Generating Pre-signed URL...');
        const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
        const presignedURL = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('Pre-signed URL to get the object:', presignedURL);

        // Use fetch() to retrieve the object using the pre-signed URL
        const response = await fetch(presignedURL);
        const object = await response.text();
        console.log('Object retrieved with pre-signed URL:', object);
    } catch (err) {
        console.error('Error:', err);
    }
}

// Run the main function
main();

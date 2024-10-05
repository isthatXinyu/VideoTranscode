const { S3Client, CreateBucketCommand, PutBucketTaggingCommand, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Configuration variables
const bucketName = 'n10366687-test';  
const qutUsername = 'n10366687@qut.edu.au';
const purpose = 'prac';
const objectKey = 'uploads/myAwesomeObjectKey';  // Consider organizing objects into folders like 'uploads/'
const objectValue = 'This could be just about anything.';

// Main function to interact with S3
async function main() {
    // Create an S3 client
    const s3Client = new S3Client({ region: 'ap-southeast-2' });

    // Create a new bucket (this step only needs to be done once)
    try {
        const createBucketCommand = new CreateBucketCommand({ Bucket: bucketName });
        const response = await s3Client.send(createBucketCommand);
        console.log('Bucket created at:', response.Location);
    } catch (err) {
        if (err.name === 'BucketAlreadyOwnedByYou') {
            console.log('Bucket already exists, continuing...');
        } else {
            console.log('Error creating bucket:', err);
            return;
        }
    }

    // Tag the S3 bucket
    try {
        const tagBucketCommand = new PutBucketTaggingCommand({
            Bucket: bucketName,
            Tagging: {
                TagSet: [
                    { Key: 'qut-username', Value: qutUsername },
                    { Key: 'purpose', Value: purpose }
                ]
            }
        });
        const response = await s3Client.send(tagBucketCommand);
        console.log('Bucket tagged:', response);
    } catch (err) {
        console.log('Error tagging bucket:', err);
        return;
    }

    // Write an object to the bucket (this can be used for file uploads)
    try {
        const putObjectCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: objectValue
        });
        const response = await s3Client.send(putObjectCommand);
        console.log('Object written to bucket:', response);
    } catch (err) {
        console.log('Error writing object to bucket:', err);
        return;
    }

    // Read the object from the bucket
    try {
        const getObjectCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey
        });
        const response = await s3Client.send(getObjectCommand);
        const objectContent = await streamToString(response.Body);
        console.log('Object content:', objectContent);
    } catch (err) {
        console.log('Error reading object from bucket:', err);
        return;
    }

    // Generate a pre-signed URL to access the object (this allows temporary access to the file)
    try {
        const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
        const presignedURL = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });  // Expires in 1 hour
        console.log('Pre-signed URL for object:', presignedURL);
    } catch (err) {
        console.log('Error generating pre-signed URL:', err);
        return;
    }
}

// Helper function to convert stream to string
async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}

// Run the main function
main();

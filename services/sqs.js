const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

// Initialize SQS client
const sqsClient = new SQSClient({ region: 'ap-southeast-2' });

// Function to poll messages from SQS
async function pollMessages(queueUrl) {
    const params = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 10
    };
    const command = new ReceiveMessageCommand(params);
    try {
        const data = await sqsClient.send(command);
        return data.Messages ? data.Messages : [];
    } catch (err) {
        console.error("Error polling messages:", err);
        return [];
    }
}

// Function to delete a message from SQS
async function deleteMessage(queueUrl, receiptHandle) {
    const params = {
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle
    };
    const command = new DeleteMessageCommand(params);
    try {
        await sqsClient.send(command);
        console.log("Message deleted from SQS");
    } catch (err) {
        console.error("Error deleting message from SQS:", err);
    }
}

module.exports = { sqsClient, pollMessages, deleteMessage };

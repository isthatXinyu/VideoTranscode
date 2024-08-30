Assignment 1 - Web Server - Response to Criteria
================================================

Instructions:
- This file is a response to the criteria for the web server assignment.
- Each section provides a description, relevant video timestamps, and associated files that demonstrate the implementation of the criteria.

Overview
------------------------------------------------

- **Name:** Xinyu Qian
- **Student number:** 10366687
- **Application name:** Video Transcoder
- **Two-line description:** This application allows users to upload videos, select formats and resolutions, and transcode the videos. Users can download the transcoded videos and track progress.

Core criteria
------------------------------------------------

### Docker image

- **ECR Repository name**: isthatxinyu
- **Video timestamp:** 0:15
- **Relevant files:**
    - /Dockerfile 

### Docker image running on EC2

- **EC2 instance ID**: i-0aa31796169c6aaf7
- **Video timestamp:** 0:30
- **Relevant files:**
    - /Dockerfile 

### User login functionality

- **One line description:** Implemented user authentication with JWTs, supporting session management and login protection.
- **Video timestamp:** 0:45
- **Relevant files:**
    - /routes/auth.js 

### User dependent functionality

- **One line description:** Users can only see and manage their own uploaded videos. Admins have access to all videos.
- **Video timestamp:** 1:00
- **Relevant files:**
    - /routes/video.js 
    - /routes/upload.js 

### Web client

- **One line description:** The web client is designed with a responsive UI allowing users to upload videos, select transcoding options, and download results.
- **Video timestamp:** 0:45
- **Relevant files:**
    - /views/index.ejs 
    - /public/styles.css【11:0†source】
    - /public/upload.html【12:0†source】

### REST API

- **One line description:** REST API is designed with standard HTTP methods, appropriate status codes, and logical endpoint naming.
- **Video timestamp:** 0:30
- **Relevant files:**
    - /routes/upload.js 
    - /routes/video.js 

### Two kinds of data

#### First kind

- **One line description:** Video files uploaded by users.
- **Type:** Unstructured data.
- **Rationale:** Videos are large files, stored separately, and managed without database integration for efficiency.
- **Video timestamp:** 1:30
- **Relevant files:**
    - /routes/upload.js 
    - /routes/video.js 

#### Second kind

- **One line description:** Metadata about videos, including ownership and transcoding progress.
- **Type:** Structured data stored in MongoDB.
- **Rationale:** Metadata needs to be queried efficiently to manage user interactions and transcoding processes.
- **Video timestamp:** 1:45
- **Relevant files:**
    - /routes/upload.js 
    - /routes/video.js 

### CPU intensive task

- **One line description**: Video transcoding is performed using FFmpeg, which is a CPU-intensive process.
- **Video timestamp:** 2:00
- **Relevant files:**
    - /routes/video.js 

### CPU load testing method

- **One line description**: Node.js script to generate multiple transcoding requests, pushing CPU usage above 90%.
- **Video timestamp:** 2:30
- **Relevant files:**
    - /loadTest.js

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description**: Supports advanced features such as pagination, filtering, and sorting.
- **Video timestamp:** 1:00
- **Relevant files:**
    - /middleware/pagination.js
    - /routes/video.js 

### Use of external API(s)

- **One line description**: Integration with an external API to fetch related video metadata.
- **Video timestamp:** 1:00
- **Relevant files:**
    - /routes/apiIntegration.js

### Extensive web client features

- **One line description**: Advanced web client features include video previews, format selection, and live progress updates.
- **Video timestamp:** 1:30
- **Relevant files:**
    - /public/upload.html 

### Live progress indication

- **One line description**: The client polls the server for progress updates during video transcoding, updating the UI in real-time.
- **Video timestamp:** 3:00
- **Relevant files:**
    - /routes/video.js 
    - /public/upload.html 

### Infrastructure as code

- **One line description**: Docker Compose is used to manage application and database containers.
- **Video timestamp:** 0:25
- **Relevant files:**
    - /docker-compose.yml

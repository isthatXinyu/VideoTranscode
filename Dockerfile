# Use an official Node.js runtime as a parent image
FROM node:14

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Set the working directory
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# ENV MONGODB_URL="mongodb+srv://xinyuqian1231:drcNf24jIcvctrrX@cluster0.tfta3j2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
# Expose the port the app runs on
EXPOSE 3000

# Command to run the app
CMD ["node", "app.js"]

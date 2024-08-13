import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import { ApiError } from "./errorHandler.js";


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null

        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath)
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}
/*RESPONSE OBJECT CONTAINS THESE PAYLOAD IF IMAGE IS UPLOADED
{
  "asset_id": "abcd1234efgh5678ijkl9012mnop3456",
  "public_id": "sample_image",
  "version": 1691672392,
  "version_id": "1a2bc3de45f67g89h01234ijkl56mnop",
  "signature": "7d8f9e0a1bc2def3gh4ijkl5mno6pqrs",
  "width": 1920,
  "height": 1080,
  "format": "jpg",
  "resource_type": "image",
  "created_at": "2024-08-09T10:59:52Z",
  "tags": [],
  "bytes": 2345678,
  "type": "upload",
  "etag": "1234567890abcdef1234567890abcdef",
  "placeholder": false,
  "url": "http://res.cloudinary.com/demo/image/upload/v1691672392/sample_image.jpg",
  "secure_url": "https://res.cloudinary.com/demo/image/upload/v1691672392/sample_image.jpg",
  "access_mode": "public",
  "original_filename": "my_uploaded_image",
  "original_extension": "jpg",
  "api_key": "123456789012345"
}

RESPONSE OBJECT CONTAINS THESE PAYLOAD IF VIDEO IS UPLOADED
{
  "asset_id": "abcd1234efgh5678ijkl9012mnop3456",
  "public_id": "sample_video",
  "version": 1691672392,
  "version_id": "1a2bc3de45f67g89h01234ijkl56mnop",
  "signature": "7d8f9e0a1bc2def3gh4ijkl5mno6pqrs",
  "width": 1280,
  "height": 720,
  "format": "mp4",
  "resource_type": "video",
  "created_at": "2024-08-09T11:59:52Z",
  "tags": [],
  "bytes": 34567890,
  "duration": 120.5,
  "type": "upload",
  "etag": "1234567890abcdef1234567890abcdef",
  "placeholder": false,
  "url": "http://res.cloudinary.com/demo/video/upload/v1691672392/sample_video.mp4",
  "secure_url": "https://res.cloudinary.com/demo/video/upload/v1691672392/sample_video.mp4",
  "access_mode": "public",
  "original_filename": "my_uploaded_video",
  "original_extension": "mp4",
  "api_key": "123456789012345",
  "frame_rate": 30.0,
  "bit_rate": 500000,
  "audio": {
    "codec": "aac",
    "bit_rate": "128k",
    "frequency": 44100,
    "channels": 2
  },
  "video": {
    "pix_format": "yuv420p",
    "codec": "h264",
    "profile": "Main",
    "level": 4.0
  }
}

*/

const deleteFromCloudinary= async (resourceUrl, resourceType = 'image') => {
    try {
        const publicId = resourceUrl.split('/').pop().split('.')[0];   
        //https://res.cloudinary.com/your-cloud-name/image/upload/public_id.jpg    this is the url and we need the last public id because only via public id we can destroy the file from cloudinary


        // Delete the image from Cloudinary
        const result = await cloudinary.uploader.destroy(publicId,
            {
                resource_type:resourceType,
            }
        );

        if (result.result === 'ok') {
            console.log(`${resourceType} deleted successfully from Cloudinary`);
        } else {
            throw new Error(500,`Failed to delete ${resourceType} from Cloudinary`);
        }

    } catch (error) {
        throw new ApiError(500,`Error deleting ${resourceType} from Cloudinary: ${error.message}`);
    }
}


export {uploadOnCloudinary,deleteFromCloudinary}


/*
isme hum kya kar rahe hai ki pehle user ko upload karvarhe hai file hmare local server par fir hum apne local server se file ko
cloudinary par upload karvare hai ye islie kar rhe hai taki ek bar file hmare server par aye fir usko agar reupload vgrh karna hai 
to hum apne hi server se kar de



import { v2 as cloudinary } from "cloudinary";
import fs from "fs";  
//file systen jo file ko read open delete vgrh karne ki functionality provide karta hai (unlink karne ke lie use kia hai specifically humne yha pr kyuki ek bar user ne hmare server par file upload krdi to hum unlink kardenge file ko bcz ab hum usko apne local server se directly upload karskte hai clooudinary par)

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary= async (localFilePath)=>{
    try {
        if (!localFilePath) return null;

        //file uploading on cloudinary
        const response= await cloudinary.uploader.upload
        (localFilePath,{
            resource_type: "auto"
        })

        //file uploaded succesfully
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) //unlink kardia file ko local browser se taki hmare browser mai faltu malicious files na stored hojaye
        console.log("file uploading failed")
    }
}

export {uploadOnCloudinary}
*/
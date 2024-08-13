import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/errorHandler.js";
import { User} from "../models/user.model.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose, { Schema } from "mongoose";

const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser= asyncHandler(async (req,res)=>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


//  1.) get user details from frontend
    const {fullname, email, password, username}=req.body
    

//  2.) validation - not empty    
    if(
        [fullname, email, password, username].some((field) => field?.trim === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

//  3.) check if user already exists: username, email  
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }


//  4.) check for images, check for avatar
// this is how data is present in req.files as we uploaded avatar and cover image in server via multer
// {  
//     "avatar": [
//       {
//         "fieldname": "avatar",
//         "originalname": "avatar.jpg",
//         "encoding": "7bit",
//         "mimetype": "image/jpeg",
//         "destination": "public/uploads/",
//         "filename": "avatar.jpg",
//         "path": "public/uploads/avatar.jpg",
//         "size": 12345
//       }
//     ],
//     "coverImage": [
//       {
//         "fieldname": "coverImage",
//         "originalname": "cover.jpg",
//         "encoding": "7bit",
//         "mimetype": "image/jpeg",
//         "destination": "public/uploads/",
//         "filename": "cover.jpg",
//         "path": "public/uploads/cover.jpg",
//         "size": 67890
//       }
//     ]
//   }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

//  5.) upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(500, "SORRY!! There is a problem in uploading the Avatar file")
    }

//  6.) create user object - create entry in db
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

//  7.) remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

//  8.) check for user creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

//  9.) return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})

const loginUser = asyncHandler(async (req,res) => {
    // req body -> data
    // username or email based login
    // find the user
    // password check
    // access and referesh token generation
    // send cookie


//  1) req body -> data
    const {username, email, password} = req.body
    if(!username && !email){
        throw new ApiError(400,"username or email is required")
    }

//  2) username or email based login
//  3) find the user
    const user = await User.findOne({
        $or: [ {username}, {email} ]
    })
    if(!user){
        throw new ApiError(400,"User doesn't exist")
    }

//  4) password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(400,"Invalid user credentials")
    }

//  5) generation of access and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

//  6) send cookie    
//  as the pass and refresh token field should not to be send to the frontend via cookie
//  that's why deselecting them

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {    // isse cookie jo hai keval backend par hi modify ho sakti hai front end par ni
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )


})

const logoutUser = asyncHandler(async (req,res) => {
//logout karte time ye dikkt aa ri thi ki humare pas koi user ki id nhi thi jisse hum user ko data base mai find 
//kar paye islie humne middleware bnaya taki humare pas user ka access mil jaye taki hum db calls kar paye

    
//  1) user find and user credentials ko update(refresh token ko delete karna as log out karlia user ne)
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

//  2) cookies clear
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, req.user, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken //encrypted token from jwt

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(  //decoded token from jwt
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        //we store encrypted token in db that's why verifying the encrypted token with the token stored in the db
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler( async (req,res) => {

//  1) take (destructure) data from the user 
    const {oldPassword, newPassword} = req.body

    if(oldPassword===newPassword) throw new ApiError(404,"old and new password must be different")

//  2) user ne jo password enter kia hai or jo databse mai us user ka respective password hai use match karayenge
    const user = await User.findById(req.user?._id)  
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(404,"Invalid old password")
    }

//  3) new password ko db mai save
    user.password = newPassword
    await user.save({validateBeforeSave: false}) //humne presave middleware lgaya hai model file mai user ke to jab bhi user save hoga usse pehle presave middleware run hoga or password ko encrypt kardega for security reasons

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

}) 

const getCurrentUser = asyncHandler(async (req,res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    //update fields take from body
    //check if all fields are given or not
    //update the fields in the db also

    const {fullName, email} = req.body
    
    if (!fullName && !email) {
        throw new ApiError(400, "All fields are required")
    }
    
    const UpdateObject={};
    if(fullName) UpdateObject.fullname=fullName;
    if(email) UpdateObject.email=email;

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: UpdateObject
        },
        {new: true}     // ye hota hai taki jo object return ho usme updated values ho na ki old values
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res) => {

try {
    //  1) avatar ka local path multer ke through access kara
        const avatarLocalPath = req.file?.path
        if (!avatarLocalPath) {
            throw new ApiError(400, "Avatar file is missing")
        }
    
        const avatar = await uploadOnCloudinary(avatarLocalPath)
        if (!avatar.url) {
            throw new ApiError(400, "Error while uploading on avatar")
            
        }
    
        // delete old image - assignment
        // Retrieve the current user from the request object
        const user = req.user;
        // Check if the user has a current cover image URL
        if (user.avatar) {
            // Delete the current cover image from Cloudinary
            await deleteFromCloudinary(user.avatar); //  function to delete image from Cloudinary
        }

    //  2) update kardia avatar ka url in db
        const updatedUser = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    avatar: avatar.url
                }
            },
            {new: true}
        ).select("-password")
    
        
    
    //  response send
        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedUser, "Avatar image updated successfully")
        )
} catch (error) {
    throw new ApiError(400,"Internal Server Error");
}

})

const updateUserCoverImage = asyncHandler(async (req,res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(500, "Error while uploading on Cover image")
    
    }

    // delete old image - assignment
    // Retrieve the current user from the request object
    const user = req.user;
    // Check if the user has a current cover image URL
    if (user.coverImage) {
        // Delete the current cover image from Cloudinary
        await deleteFromCloudinary(user.coverImage); //  function to delete image from Cloudinary
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedUser, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }

        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "User does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory

}


//AGGREGATION PIPELINE IN DETAIL EXPLAINATION
/*
Let's go step by step to understand how the User and Subscription schemas work, how data is stored in MongoDB, and how the aggregation pipeline processes the data.

1. Schemas Overview
User Schema:
The User schema defines how a user's data is structured in the database. Here's a simplified version:

javascript
Copy code
const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    fullname: { type: String, required: true },
    avatar: { type: String, required: true },
    coverImage: { type: String },
    watchHistory: [{ type: Schema.Types.ObjectId, ref: "Video" }],
    password: { type: String, required: true },
    refreshToken: { type: String }
}, { timestamps: true });
Subscription Schema:
The Subscription schema represents the relationship between a subscriber (user) and a channel (another user). Here's a simplified version:

javascript
Copy code
const subscriptionSchema = new Schema({
    subscriber: { type: Schema.Types.ObjectId, ref: "User" }, // The user who is subscribing
    channel: { type: Schema.Types.ObjectId, ref: "User" }     // The user who is being subscribed to
}, { timestamps: true });
2. Data Storage in MongoDB
User Collection:
Each document in the users collection represents a single user. For example:

json
Copy code
{
    "_id": "64d0e0e85b9d0739bc5b60b3",
    "username": "johndoe",
    "email": "johndoe@example.com",
    "fullname": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "coverImage": "https://example.com/cover.jpg",
    "watchHistory": ["64d0e0e85b9d0739bc5b6123", "64d0e0e85b9d0739bc5b6124"], // References to Video documents
    "password": "$2b$10$somethingencrypted",
    "refreshToken": "sometoken",
    "createdAt": "2024-08-08T12:00:00.000Z",
    "updatedAt": "2024-08-08T12:00:00.000Z"
}
Subscription Collection:
Each document in the subscriptions collection represents a single subscription, where a subscriber subscribes to a channel:

json
Copy code
{
    "_id": "64d0e0e85b9d0739bc5b60b4",
    "subscriber": "64d0e0e85b9d0739bc5b60b5", // The user who subscribed
    "channel": "64d0e0e85b9d0739bc5b60b3",    // The channel being subscribed to
    "createdAt": "2024-08-08T12:00:00.000Z",
    "updatedAt": "2024-08-08T12:00:00.000Z"
}
3. Behind the Scenes: Subscriptions
In the Subscription schema, each document is a single subscription entry. We are not storing users in arrays but rather creating individual documents for each subscription.

If User A subscribes to User B, a document is created with subscriber pointing to User A's _id and channel pointing to User B's _id.
If User A subscribes to multiple channels, each subscription will have its own document in the subscriptions collection.
If multiple users subscribe to User B, each of those subscriptions will also have separate documents.
4. Aggregation Pipeline Explained
Let's break down the pipeline you provided, step by step.

Pipeline Example:
javascript
Copy code
const channel = await User.aggregate([
    {
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
        $lookup:{
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }
    },
    {
        $addFields: {
            subscribersCount: {
                $size: "$subscribers"
            },
            channelsSubscribedToCount: {
                $size: "$subscribedTo"
            },
            isSubscribed: {
                $cond: {
                    if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    }
]);
Step-by-Step Explanation
1. $match
javascript
Copy code
{
    $match: {
        username: username?.toLowerCase()
    }
}
Purpose: Filters the users collection to find the user whose username matches the provided username. This limits the aggregation to only that user.
Example: If username = "johndoe", this step will retrieve the document for johndoe.
2. $lookup (subscribers)
javascript
Copy code
{
    $lookup:{
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
    }
}
Purpose: Joins the subscriptions collection with the users collection. It looks for all documents in the subscriptions collection where the channel field matches the _id of the johndoe user. The result is stored in the subscribers array.
Example: If 5 users are subscribed to johndoe, the subscribers array will contain 5 documents, each representing a subscription to johndoe.
3. $lookup (subscribedTo)
javascript
Copy code
{
    $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
    }
}
Purpose: Similar to the previous $lookup, but this time it looks for subscriptions where johndoe is the subscriber. The result is stored in the subscribedTo array.
Example: If johndoe is subscribed to 2 channels, the subscribedTo array will contain 2 documents, each representing a channel that johndoe is subscribed to.
4. $addFields
javascript
Copy code
{
    $addFields: {
        subscribersCount: {
            $size: "$subscribers"
        },
        channelsSubscribedToCount: {
            $size: "$subscribedTo"
        },
        isSubscribed: {
            $cond: {
                if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                then: true,
                else: false
            }
        }
    }
}
Purpose: Adds additional fields to the user document.
subscribersCount: Counts the number of documents in the subscribers array, i.e., how many users are subscribed to johndoe.
channelsSubscribedToCount: Counts the number of documents in the subscribedTo array, i.e., how many channels johndoe is subscribed to.
isSubscribed: Checks if the currently logged-in user (req.user?._id) is in the list of subscribers. If so, it sets isSubscribed to true, otherwise false.
Final Result
After the pipeline runs, the final document for johndoe will include the additional fields (subscribersCount, channelsSubscribedToCount, isSubscribed) along with the original fields (username, email, etc.).

Example Final Document:
json
Copy code
{
    "_id": "64d0e0e85b9d0739bc5b60b3",
    "username": "johndoe",
    "email": "johndoe@example.com",
    "fullname": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "coverImage": "https://example.com/cover.jpg",
    "watchHistory": ["64d0e0e85b9d0739bc5b6123", "64d0e0e85b9d0739bc5b6124"],
    "password": "$2b$10$somethingencrypted",
    "refreshToken": "sometoken",
    "createdAt": "2024-08-08T12:00:00.000Z",
    "updatedAt": "2024-08-08T12:00:00.000Z",
    "subscribers": [
        // 5 subscriber documents
    ],
    "subscribedTo": [
        // 2 subscribedTo documents
    ],
    "subscribersCount": 5,
    "channelsSubscribedToCount": 2,
    "isSubscribed": false
}
Summary
User Data: Stored in the users collection, with each user having their own document.
Subscription Data: Stored in the subscriptions collection, with each subscription having
if: {$in: [req.user?._id, "$subscribers.subscriber"]}, this in operator checks for every document of the subscribers?
ChatGPT
Yes, the $in operator in the context {$in: [req.user?._id, "$subscribers.subscriber"]} checks if the current user's _id (from req.user?._id) is present in the array of subscriber _ids.

Here's how it works:

$subscribers.subscriber: This is an array of all the subscriber fields from the subscribers array that was populated using the $lookup stage. Each element in this array represents a subscriber's _id.

$in Operator: The $in operator checks if the value on the left side (req.user?._id) exists within the array on the right side ("$subscribers.subscriber").

Example:
Let's say the subscribers array looks like this:

json
Copy code
"subscribers": [
    { "subscriber": "64d0e0e85b9d0739bc5b60b5" },
    { "subscriber": "64d0e0e85b9d0739bc5b60b6" },
    { "subscriber": "64d0e0e85b9d0739bc5b60b7" },
    { "subscriber": "64d0e0e85b9d0739bc5b60b8" },
    { "subscriber": "64d0e0e85b9d0739bc5b60b9" }
]
If req.user?._id is "64d0e0e85b9d0739bc5b60b7", the $in operator will check:

Is "64d0e0e85b9d0739bc5b60b7" in ["64d0e0e85b9d0739bc5b60b5", "64d0e0e85b9d0739bc5b60b6", "64d0e0e85b9d0739bc5b60b7", "64d0e0e85b9d0739bc5b60b8", "64d0e0e85b9d0739bc5b60b9"]?
The answer is yes, so isSubscribed would be set to true.

If req.user?._id is "64d0e0e85b9d0739bc5b60c0" (which is not in the subscribers array), the answer would be no, and isSubscribed would be false.

This operation is performed efficiently by MongoDB and checks every subscriber document in the subscribers array to see if it matches the current user's _id.
*/


 
//AGGREGATION FOR WATCH HISTORY
/*
Certainly! Let's break down how the $lookup stage works in your aggregation pipeline for the watchHistory and video collections, using a concrete example.

Example Collections
1. users Collection:
json
Copy code
[
    {
        "_id": "user1",
        "username": "john_doe",
        "watchHistory": [
            "video1",
            "video2"
        ]
    }
]
2. videos Collection:
json
Copy code
[
    {
        "_id": "video1",
        "title": "Intro to MongoDB",
        "description": "A beginner's guide to MongoDB.",
        "duration": 15,
        "views": 1000,
        "isPublished": true,
        "owner": "user2"
    },
    {
        "_id": "video2",
        "title": "Advanced Aggregation",
        "description": "Deep dive into MongoDB aggregation.",
        "duration": 30,
        "views": 2000,
        "isPublished": true,
        "owner": "user3"
    }
]
3. users Collection (for video owners):
json
Copy code
[
    {
        "_id": "user2",
        "username": "jane_smith",
        "avatar": "jane_avatar.jpg"
    },
    {
        "_id": "user3",
        "username": "alice_jones",
        "avatar": "alice_avatar.jpg"
    }
]
Your Aggregation Pipeline:
javascript
Copy code
const user = await User.aggregate([
    {
        $match: {
            _id: new mongoose.Types.ObjectId(req.user._id)
        }
    },
    {
        $lookup: {
            from: "videos",                       // Collection to join with
            localField: "watchHistory",          // Field in the users collection
            foreignField: "_id",                 // Field in the videos collection
            as: "watchHistory",                  // Name of the new field
            pipeline: [
                {
                    $lookup: {
                        from: "users",           // Collection to join with (for video owners)
                        localField: "owner",    // Field in the videos collection
                        foreignField: "_id",    // Field in the users collection
                        as: "owner",            // Name of the new field
                        pipeline: [
                            {
                                $project: {      // Specify which fields to include
                                    username: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    }
                },
                {
                    $addFields: {
                        owner: {                // Flatten the "owner" array
                            $first: "$owner"
                        }
                    }
                }
            ]
        }
    }
])
Step-by-Step Breakdown:
$match Stage:

Filters the users collection to find the document with _id matching req.user._id (e.g., "user1").
Result:
json
Copy code
{
    "_id": "user1",
    "username": "john_doe",
    "watchHistory": [
        "video1",
        "video2"
    ]
}
$lookup Stage:

Purpose: Joins the videos collection to get details of the videos in the watchHistory array.
Fields:
from: "videos" specifies the collection to join with.
localField: "watchHistory" specifies the field in the users document containing the video IDs.
foreignField: "_id" specifies the field in the videos collection to match against.
as: "watchHistory" specifies the new field name where the results will be stored.
Inner Pipeline of $lookup:

Inner $lookup: Joins the users collection to get details of the video owners.

from: "users"
localField: "owner" (field in videos collection)
foreignField: "_id" (field in users collection)
as: "owner" (new field name)
Inner $project: Specifies which fields to include in the owner documents.

Result:
json
Copy code
{
    "_id": "user2",
    "username": "jane_smith",
    "avatar": "jane_avatar.jpg"
}
Inner $addFields: Flattens the owner array to have a single object instead of an array.

Result:
json
Copy code
{
    "_id": "video1",
    "title": "Intro to MongoDB",
    "description": "A beginner's guide to MongoDB.",
    "duration": 15,
    "views": 1000,
    "isPublished": true,
    "owner": {
        "_id": "user2",
        "username": "jane_smith",
        "avatar": "jane_avatar.jpg"
    }
}
Result of $lookup:

json
Copy code
{
    "_id": "user1",
    "username": "john_doe",
    "watchHistory": [
        {
            "_id": "video1",
            "title": "Intro to MongoDB",
            "description": "A beginner's guide to MongoDB.",
            "duration": 15,
            "views": 1000,
            "isPublished": true,
            "owner": {
                "_id": "user2",
                "username": "jane_smith",
                "avatar": "jane_avatar.jpg"
            }
        },
        {
            "_id": "video2",
            "title": "Advanced Aggregation",
            "description": "Deep dive into MongoDB aggregation.",
            "duration": 30,
            "views": 2000,
            "isPublished": true,
            "owner": {
                "_id": "user3",
                "username": "alice_jones",
                "avatar": "alice_avatar.jpg"
            }
        }
    ]
}


Step-by-Step Breakdown:
$match Stage:

javascript
Copy code
{
    $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
    }
}
Purpose: Filters the User collection to find a specific user by their _id.
Details:
The _id is typically a unique identifier for each user. The new mongoose.Types.ObjectId(req.user._id) converts the req.user._id to an ObjectId type, which MongoDB uses as the identifier for documents in the User collection.
Example Result: After this stage, you have a single user document with the specified _id.
json
Copy code
{
    "_id": "64d0e0e85b9d0739bc5b60c0",
    "username": "johndoe",
    "watchHistory": ["64d0e0e85b9d0739bc5b60a1", "64d0e0e85b9d0739bc5b60a2"]
}
$lookup Stage (First Level):

javascript
Copy code
{
    $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [ ... ]
    }
}
Purpose: Performs a join operation between the User collection and the Video collection.
Details:
from: Specifies the target collection (videos) to join with.
localField: The field in the User document (watchHistory) that contains references to the Video documents (an array of ObjectIds).
foreignField: The field in the Video collection (_id) that corresponds to the references in watchHistory.
as: The name of the field to store the results of the join. In this case, it overwrites the watchHistory field with the full video documents.
Sub-Pipeline Inside $lookup:

Sub-Pipeline Objective: To enrich the watchHistory documents with additional details about the video owner.
$lookup Stage (Second Level) Inside Sub-Pipeline:

javascript
Copy code
{
    $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1
                }
            }
        ]
    }
}
Purpose: Joins each Video document with its owner in the User collection to retrieve specific details about the owner.
Details:
from: Specifies the target collection (users).
localField: The field in the Video document (owner) that references the user who owns the video.
foreignField: The field in the User collection (_id) that corresponds to the owner in the Video document.
as: The name of the field to store the result of this join, here it's owner, which will be an array.
pipeline: A nested aggregation pipeline that only projects ($project) the fullName, username, and avatar fields from the owner.
Result After Second $lookup:

The owner field in each Video document is now an array containing a single object with the selected fields (fullName, username, avatar).
json
Copy code
{
    "_id": "64d0e0e85b9d0739bc5b60a1",
    "title": "Learning MongoDB",
    "owner": [
        {
            "fullName": "Jane Doe",
            "username": "janedoe",
            "avatar": "janedoe-avatar.jpg"
        }
    ]
}
$addFields Stage:

javascript
Copy code
{
    $addFields:{
        owner:{
            $first: "$owner"
        }
    }
}
Purpose: Converts the owner field from an array to a single object.
Details:
$first: Takes the first element of the owner array. Since the $lookup always returns an array, even if it's a single item, this step ensures that owner is a single object rather than an array with one element.
Result After $addFields:

The owner field in each Video document is now a single object with the necessary details.
json
Copy code
{
    "_id": "64d0e0e85b9d0739bc5b60a1",
    "title": "Learning MongoDB",
    "owner": {
        "fullName": "Jane Doe",
        "username": "janedoe",
        "avatar": "janedoe-avatar.jpg"
    }
}
Final Result:

After all the stages, the watchHistory field in the User document is populated with enriched Video documents, each containing the video owner's basic information.
json
Copy code
{
    "_id": "64d0e0e85b9d0739bc5b60c0",
    "username": "johndoe",
    "watchHistory": [
        {
            "_id": "64d0e0e85b9d0739bc5b60a1",
            "title": "Learning MongoDB",
            "owner": {
                "fullName": "Jane Doe",
                "username": "janedoe",
                "avatar": "janedoe-avatar.jpg"
            }
        },
        {
            "_id": "64d0e0e85b9d0739bc5b60a2",
            "title": "Introduction to Node.js",
            "owner": {
                "fullName": "John Smith",
                "username": "johnsmith",
                "avatar": "johnsmith-avatar.jpg"
            }
        }
    ]
}
*/



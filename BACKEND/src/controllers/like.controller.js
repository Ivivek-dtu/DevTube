import mongoose, {isValidObjectId, Schema} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/errorHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video

    const userId = req.user?._id;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400,"Invalid ID Format")
    }

    try {
        const isLiked = await Like.findOne({
            $and: [
                {video: videoId},
                {likedBy: userId}
            ]
        })
    
        if(isLiked){
            const likeRemove = await Like.findOneAndDelete({
                $and: [
                    {video: videoId},
                    {likedBy: userId}
                ]
            })
    
            if(likeRemove) res.status(200).
            json(new ApiResponse(200,likeRemove,"Like Removed from Video successfully"));
    
            throw new ApiError(500,"Internal Server Error!! please try disliking again ");
        } 
    
        const likeDone = await Like.create({
            video:videoId,
            likedBy:userId,
        });
    
        res.status(200).
            json(new ApiResponse(200,likeDone,"Video Liked successfully"));
    
    } catch (error) {
        console.error("Error toggling liked status:", error);
        throw new ApiError(500, "Internal Server Error" );
    }

})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment

    const userId = req.user?._id;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400,"Invalid ID Format")
    }

    try {
        const isLiked = await Like.findOne({
            $and: [{comment: commentId},{likedBy: userId}]
        })
    
        if(isLiked){
            const likeRemove = await Like.findOneAndDelete({
                $and: [{comment: commentId},{likedBy: userId}]
            })
    
            if(likeRemove) res.status(200).
            json(new ApiResponse(200,likeRemove,"Like Removed from comment successfully"));
    
            throw new ApiError(500,"Internal Server Error!! please try disliking again ");
        } 
    
        const likeDone = await Like.create({
            comment:commentId,
            likedBy:userId,
        });
    
        res.status(200).
            json(new ApiResponse(200,likeDone,"Comment Liked successfully"));
    
    } catch (error) {
        console.error("Error toggling liked status:", error);
        throw new ApiError(500, "Internal Server Error" );
    }

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet

    const userId = req.user?._id;

    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400,"Invalid ID Format")
    }

    try {
        const isLiked = await Like.findOne({
            $and: [{tweet: tweetId},{likedBy: userId}]
        })
    
        if(isLiked){
            const likeRemove = await Like.findOneAndDelete({
                $and: [{tweet: tweetId},{likedBy: userId}]
            })
    
            if(likeRemove) res.status(200).
            json(new ApiResponse(200,likeRemove,"Like Removed from tweet successfully"));
    
            throw new ApiError(500,"Internal Server Error!! please try disliking again ");
        } 
    
        const likeDone = await Like.create({
            tweet:tweetId,
            likedBy:userId,
        });
    
        res.status(200).
            json(new ApiResponse(200,likeDone,"Tweet Liked successfully"));
    
    } catch (error) {
        console.error("Error toggling liked status:", error);
        throw new ApiError(500, "Internal Server Error" );
    }

}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const userId = req.user?._id;
    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400,"Invalid ID Format")
    }


    const likedVideos = await Like.aggregate([
        {
            $match:{
                likedBy: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from: "videos",
                foreignField: "_id",
                localField: "video",
                as: "video",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            foreignField: "_id",
                            localField: "owner",
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        username:1,
                                        fullname:1,
                                        avatar:1, 
                                    }
                                }
                            ]
                        }   
                    },
                    {
                        $unwind: "$owner",
                    }
                ]
            }   
        },
        {
            $unwind: "$video" 
        },
        {
            $sort:{
                "video.createdAt": -1
            }
        },
        {
            $project:{
                videoFile: "$video.videoFile",
                thumbnail: "$video.thumbnail",
                title: "$video.title",
                description: "$video.description",
                duration: "$video.duration",
                views: "$video.views",
                isPublished: "$video.isPublished",
                owner: "$video.owner",
                createdAt: "$video.createdAt"
            }

        }
    ]);
    
    /*[ aggregation format 
        {
            "_id": "101",
            "videoFile": "file1.mp4",
            "thumbnail": "thumb1.jpg",
            "title": "Video 1",
            "description": "Desc 1",
            "duration": 120,
            "views": 100,
            "isPublished": true,
            "owner": "user1",
            "createdAt": "2024-08-10T12:00:00Z"
        },
        {
            "_id": "102",
            "videoFile": "file2.mp4",
            "thumbnail": "thumb2.jpg",
            "title": "Video 2",
            "description": "Desc 2",
            "duration": 150,
            "views": 200,
            "isPublished": true,
            "owner": "user1",
            "createdAt": "2024-08-09T12:00:00Z"
        },
    ]
    */
    
    if(!likedVideos) throw new ApiError(500,"Internal server Error!! please try again")
    
    res.status(200).
    json(new ApiResponse(200,likedVideos,"videos fetched successfully"));
    

})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}
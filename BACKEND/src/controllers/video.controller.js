import mongoose, {isValidObjectId, Schema} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/errorHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"



const getAllVideos = asyncHandler(async (req, res) => {
    //TODO: get all videos based on query, sort, pagination
    //https://www.youtube.com/watch?v=MbslvX0AMVE || https://www.youtube.com/watch?v=0T4GsMYnVN4 filters and pagination concept
    
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    console.log("req",req.query)
    const pipeline = [];

    //text based searching
    if(query){
        pipeline.push({
            $search: {
                index: "videos",
                text: {
                    query: query,
                    path: ["title", "description"] //search only on title, desc
                }
            }
        });
    }

    if(userId){
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }
        pipeline.push({
            $match:{
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    pipeline.push({
        $match:{
            isPublished: true
        }
    });

    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } 
    else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
        {
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline:[
                    {
                        $project: {
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )

    
    console.log(pipeline);

    //dont await here this is the syntax for aggregate paginate this is passed to aggregate paginate
    const aggregateVideos=  Video.aggregate(pipeline);
    const options= {
        page: parseInt(page,10),
        limit: parseInt(limit,10) 
    };

    const videos = await Video.aggregatePaginate(aggregateVideos, options);
    // videos WILL CONTAIN THIS OBJECT 
    // {
    //     "docs": [
    //         // Documents for page 2
    //     ],
    //     "totalDocs": 20,
    //     "limit": 5,
    //     "totalPages": 4,
    //     "page": 2
    // }

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"));



})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    try {
        const videoFileLocalPath = req.files?.videoFile[0]?.path;
        if(!videoFileLocalPath) throw new ApiError(400, "Video File file is required");
    
        const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
        if(!thumbnailLocalPath) throw new ApiError(400, "Thumbnail file is required");
    
        const videoFile = await uploadOnCloudinary(videoFileLocalPath);
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    
        if (!thumbnail ) {
            await deleteFromCloudinary(videoFile.url,'video');
            throw new ApiError(500, "SORRY!! There is a problem in uploading the Thumbnail")
        }
        if(!videoFile){
            await deleteFromCloudinary(thumbnail.url);
            throw new ApiError(500, "SORRY!! There is a problem in uploading the Video ")
        }   
    
        const video = await Video.create({
            videoFile: videoFile?.url,
            thumbnail: thumbnail?.url,
            title,
            description,
            duration: videoFile?.duration,
            isPublished:true,
            owner: req.user._id,
            isPublished: true
    
        })
    
        return res.status(201)
        .json(new ApiResponse(201,video,"Video published successfully"))
    
    } catch (error) {
        console.log(error,"Error while publishing the video")
        throw new ApiError(500, "Internal Server Error!! Please try again later")
    }



})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    try {
        //we will not fetch comments of video here as for that we have a controller in comments
        const TargetVideo = await Video.aggregate([
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(videoId),
                }
            },
            {   //video owner details fetch
                $lookup:{
                    from: "users",
                    localField: "owner",
                    foreignField:"_id",
                    as: "owner",
                    pipeline:[
                        {
                            $lookup:{
                                from: "subscriptions",
                                localField: "_id",
                                foreignField:"channel",
                                as: "subscribers",
                            }
                        },
                        {
                            $addFields:{
                                subscribersCount: {
                                    $size: "$subscribers"
                                },
                                isSubscribed: {
                                    $cond: {
                                        if: {
                                            $in: [
                                                req.user?._id,
                                                "$subscribers.subscriber"
                                            ]
                                        },
                                        then: true,
                                        else: false
                                    }
                                }
                            }
                        },
                        {
                            $project:{
                                username: 1,
                                fullname: 1,
                                avatar: 1,
                                subscribersCount:1,
                                isSubscribed:1
                            }
                        }
                    ]
                }
            },
            {//likes document fetch
                $lookup:{
                    from: "likes",
                    localField: "_id",
                    foreignField:"video",
                    as: "Likes"
                }
            },
            {
                $addFields:{
                    likesCount:{
                        $size: "$Likes"
                    },
                    isLiked:{
                        $cond: {
                            if: {$in: [req.user?._id, "$Likes.likedBy"]},
                            then: true,
                            else: false
                        }
                    },
                    owner: {
                        $first: "$owner"
                    },
                }
            },
            {
                $project:{
                    videoFile:1,
                    thumbnail:1,
                    title:1,
                    description:1,
                    duration:1,
                    views:1,
                    isPublished:1,
                    owner:1,
                    totalComments:1,
                    Comments:1,
                    likesCount:1,
                    createdAt:1,
                    isLiked:1,


                }
            }
        ]);
    
        if(!TargetVideo) throw new ApiError(404, "Video not found")

        // increment views if video fetched successfully
        await Video.findByIdAndUpdate(videoId, {
            $inc: {
                views: 1
            }
        });

        // add this video to user watch history
        await User.findByIdAndUpdate(req.user?._id, {
            $addToSet: {
                watchHistory: videoId
            }
        });
        
        return res.status(200)
        .json(new ApiResponse(200,TargetVideo[0] ,"Video details fetched successfully"))
    } catch (error) {
        throw new ApiError(500, "SORRY!! There is a problem in fetching the Video")
    }



})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const {title , description} = req.body;


    // if thumbnail feild is given to update then update else dont update
    let newThumbnailUrl;
    if (req.file?.path) {
        newThumbnailUrl = await uploadOnCloudinary(req.file.path);
        if (!newThumbnailUrl) throw new ApiError(500, "Error uploading thumbnail");
    }

    // Retrieve the current video document
    const currentVideo = await Video.findById(videoId);
    if (!currentVideo) throw new ApiError(404, "Video not found");
    if(currentVideo?.owner !== req.user?._id) throw new ApiError(404, "Only Video owner can update their video")

    const updateData = { title, description };
    if (newThumbnailUrl?.url) {
        updateData.thumbnail = newThumbnailUrl.url;
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: updateData,
        },
        { new: true, runValidators: true }
    ) 

    if (!updatedVideo) throw new ApiError(500,"Internal Server Error")

    if (currentVideo.thumbnail && newThumbnailUrl?.url) {// only delete old thumbnail if newthumbnail is there
        deleteFromCloudinary(currentVideo.thumbnail);
    }

    return res.status(200)
    .json(new ApiResponse(200,updatedVideo ,"Video Updated successfully"))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    
    const video = await Video.findById(videoId);
    if(!video) throw new ApiError(404, "Video not found")

    if(video?.owner.toString() !== req.user?._id.toString()) throw new ApiError(404, "Only Video owner can delete their video")

    const videoDeleted = await Video.findByIdAndDelete(
        videoId
    );

    if(!videoDeleted) throw new ApiError(500, "SORRY!! There is a problem in deleting the Video")
        
    return res.status(200)
    .json(new ApiResponse(200, videoDeleted ,"Video deleted successfully"))

    

})

const togglePublishStatus = asyncHandler(async (req, res) => {``
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't toogle publish status as you are not the owner"
        );
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video?.isPublished
            }
        },
        { new: true }
    );

    if (!toggledVideoPublish) {
        throw new ApiError(500, "Failed to toogle video publish status");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: toggledVideoPublish.isPublished },
                "Video publish toggled successfully"
            )
        );
});
 

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
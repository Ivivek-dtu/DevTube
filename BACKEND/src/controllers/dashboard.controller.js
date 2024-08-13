import mongoose, { Schema } from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/errorHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const userId = req.user?._id;

    const channelStatusObject = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner",
                foreignField: "channel",
                as: "Subscribers",
                pipeline: [
                    {
                        $group: {
                            _id: "$channel",
                            count: { $sum: 1 }
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                subscriberCount: { $arrayElemAt: ["$Subscribers.count", 0] },
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes",
                pipeline:[
                    {
                        $project:{
                            likedBy:1,
                        }
                    }
                ]
            }
        },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$views" },
                totalLikes: { $sum: "$likes" },
                totalSubscribers: { $max: "$subscriberCount" } ,
                totalVideos: {$sum: 1}
            }
        }
    ]);

    /*
    The $group stage in your aggregation pipeline is used to aggregate and merge documents based on specified criteria. Here's a detailed explanation of the two approaches you mentioned:

1. Grouping with _id: null
javascript
Copy code
{
    $group: {
        _id: null,
        totalViews: { $sum: "$views" },
        totalLikes: { $sum: "$likesCount" },
        totalSubscribers: { $max: "$subscriberCount" },
        totalVideos: { $sum: 1 }
    }
}
What it does: Groups all documents into a single group since _id: null indicates that all documents should be included in the same group.
Result: You'll get a single document with aggregated values for totalViews, totalLikes, totalSubscribers, and totalVideos across all videos for the specified owner.
2. Grouping by owner
javascript
Copy code
{
    $group: {
        _id: "$owner",
        totalViews: { $sum: "$views" },
        totalLikes: { $sum: "$likesCount" },
        totalSubscribers: { $max: "$subscriberCount" },
        totalVideos: { $sum: 1 }
    }
}
What it does: Groups documents by the owner field, so each distinct owner will have a separate group.
Result: You will get a document for each unique owner, showing aggregated values (total views, likes, etc.) for videos owned by each owner.
Summary of Results
With _id: null: One aggregated document is produced for all videos that match the owner filter. This is useful when you want to compute overall statistics regardless of individual owners.

With _id: "$owner": Multiple aggregated documents are produced, one for each owner. This allows you to get statistics specific to each owner’s videos.

Example Dataset and Result
Assume we have the following video documents for a specific user:

Videos:

json
Copy code
[
    { "_id": "vid1", "views": 100, "likesCount": 10, "owner": "user1" },
    { "_id": "vid2", "views": 200, "likesCount": 20, "owner": "user1" }
]
Results for each approach:

Using _id: null:

json
Copy code
{
    "totalViews": 300,
    "totalLikes": 30,
    "totalSubscribers": 0,  // Because `$max` on subscriberCount is 0
    "totalVideos": 2
}
Using _id: "$owner":

json
Copy code
[
    {
        "_id": "user1",
        "totalViews": 300,
        "totalLikes": 30,
        "totalSubscribers": 0,  // Because `$max` on subscriberCount is 0
        "totalVideos": 2
    }
]
The choice between these approaches depends on whether you need aggregated results for all videos collectively or broken down by individual owners.
*/

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {channelStatusObject,userId},
                "channel stats fetched successfully"
            )
        );


})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const userId = req.user?._id;

    const ChannelVideos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
               
                likesCount: {
                    $size: "$likes"
                }
            }
        },
        {
           $sort:{
                createdAt: -1
           } 
        },
        {
            $project: {
                _id: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                createdAt: 1,
                isPublished: 1,
                likesCount: 1,
                views: 1,
                duration:1
            }
        }
    ]);


    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            ChannelVideos,
            "channel videos fetched successfully"
        )
    );


})

export {
    getChannelStats, 
    getChannelVideos
    }
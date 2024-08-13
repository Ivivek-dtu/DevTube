import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/errorHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const userId = req.user?._id;
    const {content} = req.body;

    if(!content) throw new ApiError(400,"Content field is required");

    const newTweet = await Tweet.create({
        content,
        owner: userId
    });

    if (!newTweet) {
        throw new ApiError(500, "failed to create tweet please try again");
    }

    res.status(200).
        json(new ApiResponse(200,newTweet,"Tweet Created successfully"));

})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const {content} = req.body;
    if(!content) throw new ApiError(400,"Content field is required")

    const {tweetId} = req.params;
    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400,"Invalid ID Format")
    }

    const tweet = await Tweet.findById(tweetId);
    if(!tweet){
        throw new ApiError(400,"Tweet doesn't exists")
    }

    if(tweet.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400,"Only Tweet Owner can update thier Tweets")
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            content
        },
        {
            new:true
        }
    );

    if(!updatedTweet) throw new ApiError(500,"There's an error in updating Tweet!! Try again later");

    res.status(200).
    json(new ApiResponse(200,updatedTweet,"User Tweet Updated successfully"));




})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet

    const {tweetId} = req.params;
    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400,"Invalid ID Format")
    }

    const tweet = await Tweet.findById(tweetId);
    if(!tweet){
        throw new ApiError(400,"Tweet doesn't exists")
    }

    if(tweet.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400,"Only Tweet Owner can delete thier Tweets")
    }

    const deletedTweet = await Tweet.findByIdAndDelete(
        tweetId
    );

    if(!deletedTweet) throw new ApiError(500,"There's an error in deleting Tweet!! Try again later");

    res.status(200).
    json(new ApiResponse(200,deletedTweet,"User Tweet Deleted successfully"));

})


const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400,"Invalid ID Format")
    }

    console.log(userId);

    const userTweets = await Tweet.aggregate([
            {
                $match:{
                    owner: new mongoose.Types.ObjectId(userId),
                }
            },
            {
                $lookup:{
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline:[
                        {
                            $project:{
                                avatar: 1,
                                username:1,
                            }
                        }
                    ]
                }
            },
            {
                $unwind:"$owner"
            },
            {
                $lookup:{
                    from: "like",
                    localField: "_id",
                    foreignField: "tweet",
                    as: "Likes"
                }
            },
           
            
            {
                $addFields:{
                    LikesCount:{
                        $size: "$Likes"
                    },
                    isLiked:{
                        $cond: {
                            if: {$in: [req.user?._id, "$Likes.likedBy"]},
                            then: true,
                            else: false
                        }
                    }
                    

                }
            },
            {
                $sort:{
                    createdAt:-1,
                }
            },
            {
                $project:{
                    content:1,
                    LikesCount:1,
                    isLiked:1,
                    owner:1,
                    createdAt:1
                }
            }
        ]);


        console.log(userTweets);

    res.status(200).
    json(new ApiResponse(200,userTweets,"User Tweets fetched successfully"));

})


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
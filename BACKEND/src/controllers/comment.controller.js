import mongoose, { Schema } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/errorHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    //this aggreagte pipeline is similar to subscribtion pipeline in user where user wants to count all the subscriber and if he is subscribed or not 
    const commentsAggregate =  Comment.aggregate([
        {
            $match:{
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",

            }
        },
        {
            $unwind: "$owner"
        },
        {
            $lookup:{
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
            }    
        },
        {
            $addFields:{
                LikesCount: {
                    $size: "$likes"
                },
                isLiked:{
                    $cond: {
                        if: {$in: [req.user?._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project:{
                content: 1,
                owner:{
                    username: 1,
                    avatar: 1
                },
                LikesCount: 1,
                isLiked: 1,
            }
        }
    ]);

      

    const options={
        page:parseInt(page,10),
        limit: parseInt(limit,10) 
    }

    const comments = await Comment.aggregatePaginate(commentsAggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, comments, "Videos fetched successfully"));


})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} = req.params
    const {content} = req.body

    if (!content) {
        throw new ApiError(400, "Content is required");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const newComment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    })

    if (!newComment) {
        throw new ApiError(500, "Failed to add comment please try again");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, newComment, "Comment Added successfully"));

})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {commentId} = req.params
    const {content} = req.body

    if (!content) {
        throw new ApiError(400, "Content is required");
    }

    const comment = await Comment.findById(commentId);
    if(!comment) throw new ApiError(404, "Comment not found");

    if(comment?.owner.toString() !== req.user?._id.toString()) throw new ApiError(400, "only comment owner can edit their comment");

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set:{
                content
            }
        },
        {
            new:true,
            runValidators:true
        }
    );

    if(!updatedComment){
        throw new ApiError(500, "Failed to edit comment please try again");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedComment, "Comment Updated successfully"));


})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const {commentId} = req.params
    const {content} = req.body

    if (!content) {
        throw new ApiError(400, "Content is required");
    }

    const comment = await Comment.findById(commentId);
    if(!comment) throw new ApiError(404, "Comment not found");

    if(comment?.owner.toString() !== req.user?._id.toString()) throw new ApiError(400, "only comment owner can delete their comment");


    const deletedComment = await Comment.findByIdAndDelete(
        commentId
    );

    if(!deletedComment){
        throw new ApiError(500,"Failed to edit comment please try again")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, deletedComment, "Comment deleted successfully"));

})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }
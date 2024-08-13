import mongoose, {isValidObjectId, Schema} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/errorHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    //TODO: create playlist
    if (!name || !description) {
        throw new ApiError(400, "name and description both are required");
    }

    const userId = req.user?._id;

    const playlist = await Playlist.create({
        name,
        description,
        owner: userId,
    })

    if (!playlist) {
        throw new ApiError(500, "failed to create playlist");
    }

    return res.status(200)
    .json(new ApiResponse(200,playlist,"Playlist created Successfully"));
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists
    if(!isValidObjectId(userId)) throw new ApiError(400,"Invalid Id format");

    const playlist = await Playlist.aggregate([
        {
            $match:{
                owner: new mongoose.Types.ObjectId(userId),
            }
        },
        {
            $lookup: {
                from: 'videos', 
                localField: 'videos', 
                foreignField: '_id', 
                as: 'videosData',
                pipeline:[
                    {
                        $group:{
                            _id:null,
                            totalViews: { $sum: "$views" },
                            totalVideos: {$sum: 1}
                        }
                    }
                ]
            }

        },
        {
            $lookup:{
                from: 'videos', 
                localField: 'videos', 
                foreignField: '_id', 
                as: 'videos',
                pipeline:[
                    {
                        $project: {
                            _id: 1,
                            thumbnail: 1
                        }
                    },
                    {
                        $sort: { _id: 1 } // Sort to ensure consistent first video selection
                    },
                    {
                        $limit: 1 // Only take the first video
                    }
                ]
            }
        },
        {
            $sort:{
                createdAt: -1,
            }
        },
        {
            $project:{
                totalViews: { $arrayElemAt: ["$videosData.totalViews", 0] },
                totalVideos: { $arrayElemAt: ["$videosData.totalVideos", 0] },
                Thumbnail: { $arrayElemAt: ["$videos.thumbnail", 0] },
                description: 1,
                name: 1,

            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(200,playlist,"User Playlists fetched Successfully"));


})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id
    if(!isValidObjectId(playlistId)) throw new ApiError(400,"Invalid Id format");

    const playlistPresent = await Playlist.findById(playlistId);
    if(!playlistPresent) throw new ApiError(404,"Playlist not found");

    const UserPlaylist = await Playlist.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(playlistId),
            }
        },
        {
            $lookup: {
                from: 'videos', 
                localField: 'videos', 
                foreignField: '_id', 
                as: 'videos',
                pipeline:[
                    {
                        $lookup: {
                            from: 'users', 
                            localField: 'owner', 
                            foreignField: '_id', 
                            as: 'owner',
                            pipeline:[
                                {
                                    $project:{
                                        username: 1,
                                        fullname:1,
                                        avatar:1,

                                    }
                                }
                            ]
                        }
                    },
                    {
                        $unwind: "$owner",
                    },
                    {
                        $sort:{
                            createdAt:-1,
                        }
                    },
                    {
                        $project:{
                            videoFile: 0
                        }
                    }
                ]
            }

        },
        {
            $lookup: {
                from: 'users', 
                localField: 'owner', 
                foreignField: '_id', 
                as: 'owner',
                pipeline:[
                    {
                        $project:{
                            username: 1,
                            fullname:1,
                            avatar:1,

                        }
                    }
                ]
            }
        },
        {
            $unwind: "$owner",
        },
        
    ])


    return res.status(200)
    .json(new ApiResponse(200,UserPlaylist,"Playlist fetched Successfully"));

})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!mongoose.isValidObjectId(playlistId) || !mongoose.isValidObjectId(videoId)) throw new ApiError(400,"Invalid Id format");

    const playlist = await Playlist.findById(playlistId);
    if(!playlist) throw new ApiError(404,"Playlist not found");

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if(!video.isPublished) throw new ApiError(404,"Video is not published yet");

    if(video.owner.toString() !== req.user?._id.toString()  ){
        throw new ApiError(404,"You can only add your video to the playlist");
    }

    if(playlist.owner.toString() !== req.user?._id.toString()  ){
        throw new ApiError(404,"only owner can add their video to playlist");
    }

    if (playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video already in the playlist");
    }

    playlist.videos.push(videoId);

    await playlist.save();
    
    return res.status(200)
    .json(new ApiResponse(200,{},"Video added to Playlist Successfully"));


})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist
    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) throw new ApiError(400,"Invalid Id format");
    
    const playlist = await Playlist.findById(playlistId);
    if(!playlist) throw new ApiError(404,"Playlist not found");

    const index = playlist.videos.indexOf(videoId);
    if(index=== -1) throw new ApiError(400, "Video not present in the playlist");

    playlist.videos.splice(index,1);

    try {
        await playlist.save();
    } catch (error) {
        throw new ApiError(500, "Failed to update playlist");
    }

    return res.status(200)
    .json(new ApiResponse(200,{},"Video removed from Playlist Successfully"));
    

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
    if(!isValidObjectId(playlistId)) throw new ApiError(400,"Invalid Id format");

    const playlistExists = await Playlist.findById(playlistId);
    if(!playlistExists) throw new ApiError(400,"Playlist doesn't exists");

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

    if(!deletedPlaylist) throw new ApiError(500,"Internal Server Error!! please try again later");

    return res.status(200)
    .json(new ApiResponse(200,deletedPlaylist,"Playlist deleted Successfully"));


})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist

    if(!isValidObjectId(playlistId)) throw new ApiError(400,"Invalid Id format");

    const playlistExists = await Playlist.findById(playlistId);
    if(!playlistExists) throw new ApiError(400,"Playlist doesn't exists");

    if(!name  && !description) throw new ApiError(400,"Atleast 1 field is required");

    const updateObject={};
    if(name){
        updateObject.name= name;
    }
    if(description){
        updateObject.description= description;
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        updateObject,
        {
            new:true
        }
    );

    if(!updatedPlaylist) throw new ApiError(500,"Internal Server Error!! please try again later");

    return res.status(200)
    .json(new ApiResponse(200,updatedPlaylist,"Playlist updated Successfully"));
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
    import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/errorHandler.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400,"Invalid ID Format")
    }

    try {
        const existingSubscription = await Subscription.findOneAndDelete({
            subscriber: req.user?._id,
            channel: channelId,
        });

        if (existingSubscription) {
            // If the subscription was found and deleted, respond with success message
            return res.status(200).json(
                new ApiResponse(200, { subscribed: false }, "Unsubscribed Successfully")
            );
        }

        // If no existing subscription was found, create a new subscription (subscribe)
        await Subscription.create({
            subscriber: req.user?._id,
            channel: channelId,
        });

        return res.status(201).json(
            new ApiResponse(200, { subscribed: true }, "Subscribed Successfully")
        );


    } catch (error) {
        console.log("error while toggling the subscription");
        throw new ApiError(500,"Error toggling the subscription")
    }

    


})

// controller to return subscriber list of a channel
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const {channelId} = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400,"Invalid ID ")
    }

    try {
        
        const subscriberList = await Subscription.aggregate([
            {
                $match: {
                    channel: new mongoose.Types.ObjectId(channelId),
                }
            },
            {
                $lookup:{
                    from: "users",
                    localField: "subscriber",
                    foreignField: "_id",
                    as: "subscriber",
                    pipeline:[
                        {
                            $project:{
                                username:1,
                                avatar:1,
                            }
                        }
                    ]
                    
                },
                
            },
            {
                $unwind: "$subscriber"
            },
            {
                $sort:{
                    createdAt: -1
                }
            },
            {
                $project:{
                    subscriber:1,
                    createdAt:1,
                }
            }
        ])

        return res
            .status(200)
            .json(new ApiResponse(200, subscriberList, "User subscribers list"));
    } 
    catch (error) {
        console.error("Error fetching channel subscribers:", error);
        throw new ApiError(500, "Error fetching channel subscribers");
    }

})

// controller to return channel list to which user has subscribed
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!mongoose.isValidObjectId(subscriberId)) {
        throw new ApiError(400,"Invalid ID Format")
    }
    
    try {
        const channelList = await Subscription.aggregate([
            {
                $match:{
                    subscriber: new mongoose.Types.ObjectId(subscriberId),
                }
            },
            {
                $lookup:{
                    from: "users",
                    localField: "channel",
                    foreignField: "_id",
                    as: "channel",
                    pipeline: [
                        {
                            $project:{
                                _id: 1,
                                fullName: 1,
                                username: 1,
                                avatar: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: "$channel"
            },
            {
                $sort:{
                    createdAt: -1,
                }
            },
            {
                $group:{
                    _id: "$subscriber",
                    channels: { $push: "$channel" }
                }
            }
        ])

        return res
            .status(200)
            .json(new ApiResponse(200, channelList, "User SubscribedTO list"));
    } catch (error) {
        console.error("Error fetching subscribed channels:", error);
        throw new ApiError(500, "Error fetching subscribed channels");
    }

})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}





/* AGGREGATION PIPELINE FOR FETCHING SUBSCRIBER LIST
Let's break down the aggregation pipeline step by step using the provided dataset. Here's the dataset:

json
Copy code
[
  { "_id": "64d3b4cde35a0123f2a5a1c1", "subscriber": "64d3b4cde35a0123f2a5a1a0", "channel": "64d3b4cde35a0123f2a5a1c2" },
  { "_id": "64d3b4cde35a0123f2a5a1c3", "subscriber": "64d3b4cde35a0123f2a5a1a0", "channel": "64d3b4cde35a0123f2a5a1c4" },
  { "_id": "64d3b4cde35a0123f2a5a1c5", "subscriber": "64d3b4cde35a0123f2a5a1a1", "channel": "64d3b4cde35a0123f2a5a1c4" },
  { "_id": "64d3b4cde35a0123f2a5a1c6", "subscriber": "64d3b4cde35a0123f2a5a1a2", "channel": "64d3b4cde35a0123f2a5a1c2" }
]
Aggregation Pipeline Steps
Let's assume the aggregation pipeline is as follows:

javascript
Copy code
const subscriberList = await Subscription.aggregate([
    {
        $match: {
            channel: "64d3b4cde35a0123f2a5a1c2",
        }
    },
    {
        $lookup: {
            from: "users",
            localField: "subscriber",
            foreignField: "_id",
            as: "subscriberDetails",
            pipeline: [
                {
                    $project: {
                        _id: 1,
                        fullName: 1,
                        username: 1,
                        avatar: 1
                    }
                }
            ]
        }
    },
    {
        $unwind: "$subscriberDetails"
    },
    {
        $group: {
            _id: "$channel",
            subscribers: { $push: "$subscriberDetails" }
        }
    }
]);
Step-by-Step Explanation
$match:

Purpose: Filters documents in the Subscription collection to include only those where the channel matches 64d3b4cde35a0123f2a5a1c2.
Outcome:
The dataset after $match:
json
Copy code
[
  { "_id": "64d3b4cde35a0123f2a5a1c1", "subscriber": "64d3b4cde35a0123f2a5a1a0", "channel": "64d3b4cde35a0123f2a5a1c2" },
  { "_id": "64d3b4cde35a0123f2a5a1c6", "subscriber": "64d3b4cde35a0123f2a5a1a2", "channel": "64d3b4cde35a0123f2a5a1c2" }
]
$lookup:

Purpose: Performs a left outer join with the users collection, finding the user document in users whose _id matches the subscriber field in each document of the current dataset.
Outcome:
Assume the users collection contains the following:
json
Copy code
[
  { "_id": "64d3b4cde35a0123f2a5a1a0", "fullName": "User One", "username": "userone", "avatar": "avatar1.jpg" },
  { "_id": "64d3b4cde35a0123f2a5a1a2", "fullName": "User Two", "username": "usertwo", "avatar": "avatar2.jpg" }
]
The dataset after $lookup:
json
Copy code
[
  {
    "_id": "64d3b4cde35a0123f2a5a1c1",
    "subscriber": "64d3b4cde35a0123f2a5a1a0",
    "channel": "64d3b4cde35a0123f2a5a1c2",
    "subscriberDetails": [
      { "_id": "64d3b4cde35a0123f2a5a1a0", "fullName": "User One", "username": "userone", "avatar": "avatar1.jpg" }
    ]
  },
  {
    "_id": "64d3b4cde35a0123f2a5a1c6",
    "subscriber": "64d3b4cde35a0123f2a5a1a2",
    "channel": "64d3b4cde35a0123f2a5a1c2",
    "subscriberDetails": [
      { "_id": "64d3b4cde35a0123f2a5a1a2", "fullName": "User Two", "username": "usertwo", "avatar": "avatar2.jpg" }
    ]
  }
]
$unwind:

Purpose: Deconstructs the subscriberDetails array, so each document has a single subscriberDetails object instead of an array.
Outcome:
The dataset after $unwind:
json
Copy code
[
  {
    "_id": "64d3b4cde35a0123f2a5a1c1",
    "subscriber": "64d3b4cde35a0123f2a5a1a0",
    "channel": "64d3b4cde35a0123f2a5a1c2",
    "subscriberDetails": { "_id": "64d3b4cde35a0123f2a5a1a0", "fullName": "User One", "username": "userone", "avatar": "avatar1.jpg" }
  },
  {
    "_id": "64d3b4cde35a0123f2a5a1c6",
    "subscriber": "64d3b4cde35a0123f2a5a1a2",
    "channel": "64d3b4cde35a0123f2a5a1c2",
    "subscriberDetails": { "_id": "64d3b4cde35a0123f2a5a1a2", "fullName": "User Two", "username": "usertwo", "avatar": "avatar2.jpg" }
  }
]
$group:

Purpose: Groups the documents by the channel field and collects all subscriberDetails in an array.
Outcome:
The final dataset after $group:
json
Copy code
[
  {
    "_id": "64d3b4cde35a0123f2a5a1c2",
    "subscribers": [
      { "_id": "64d3b4cde35a0123f2a5a1a0", "fullName": "User One", "username": "userone", "avatar": "avatar1.jpg" },
      { "_id": "64d3b4cde35a0123f2a5a1a2", "fullName": "User Two", "username": "usertwo", "avatar": "avatar2.jpg" }
    ]
  }
]
Final Outcome
The final output of this aggregation pipeline will be an array of documents where each document contains a channel (identified by _id) and an array of subscribers with their details. For your specific channelId (64d3b4cde35a0123f2a5a1c2), the result will look like this:

json
Copy code
[
  {
    "_id": "64d3b4cde35a0123f2a5a1c2",
    "subscribers": [
      { "_id": "64d3b4cde35a0123f2a5a1a0", "fullName": "User One", "username": "userone", "avatar": "avatar1.jpg" },
      { "_id": "64d3b4cde35a0123f2a5a1a2", "fullName": "User Two", "username": "usertwo", "avatar": "avatar2.jpg" }
    ]
  }
]
This result shows the list of subscribers (User One and User Two) for the channel with channelId = 64d3b4cde35a0123f2a5a1c2.

*/
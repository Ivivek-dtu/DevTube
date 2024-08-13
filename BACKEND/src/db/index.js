import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"


const connectDB= async()=>{
    try {
        const connectionInstance=await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected || DB host || ${connectionInstance.connection.host}`)  // this is done kyuki kabhi kabar database production vale sever s connect hojata hai kabhi development vale server s to hume pata rahe that who is the host of the database or ye database kiska hai production ka ya development ka
    } catch (error) {
        console.log("MongoDB connection Failed",error);
        process.exit(1);
    }
}

export default connectDB;


/*mongodb mai jab bhi database connect karna ho mongooose ke through always use async await because database
hmesha alag continent mai hai manlo mongodb ne hume mumbai ka server dia data store karne ke lie par khud mongodb
ka codebase america mai hai to data ane mai time lagta hai that's why always use async await 
*/ 
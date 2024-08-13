import dotenv from "dotenv" 
import connectDB from "./db/index.js"
import app from "./app.js"

dotenv.config({
    path:'./env'
})

connectDB()
.then(()=>{
  app.listen(process.env.PORT || 8000 , ()=>{
    console.log(`server is running at port: ${process.env.PORT} `)
  }) 
})
.catch((err)=>{
  console.log("MongoDB Connection Failed " ,err)
})


/* 
  dotenv ye karta hai ki jo main file hai na usi m sare enviornment avariable ko load kara deta hai
 taki baki files mai bhi env variables load jaldi hojaye to basically main requirement iski yahi hai
  ki sari files env vali load hojaye in main file only.
  bas ji tarah se humne module js use karke import kia hai to uske lie experimental feature load karana padta h
  isse kya hota hai script file dhyan rakhti hai sare env variables ko load karane ka   
*/  
/*
-r dotenv/config --experimental-json-modules: explaination of this :->
In summary, the line you provided is configuring the Node.js environment for a project. 
It preloads via (-r) the dotenv/config module to load environment variables from a .env file and enables
experimental support for ECMAScript modules in JSON format. This is often used to set up the environment
and configuration for a Node.js application during its execution.
*/
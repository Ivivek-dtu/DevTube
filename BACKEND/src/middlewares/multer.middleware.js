import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) { // ye jo file hai arguments mai vhi main functionality hai multer ki multer ke through hum is file ka acess bhi le skte hai baki request to json data mai mil hi jati hai 
      cb(null, "./public/temp")  // ye destination hai jha hum file store karan chahte hai
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) // ye humne kia h ki file ko local server par store kis nam se karna hai to humne original name jo user ne dia hai usi nam se kar dia h pr isme ek dikkt hai agr user ne 4 file same nam se store ki hai to dikkt hojayegi par bhut km time ke lie hi file server par upload hogi kyuki vo fir cloudinary par upload karva denge to abhi ke lie dikkt nhi hai par bad mai scale karo project to functionality add karni pdegi
    }
  })
  
export const upload = multer({ 
    storage, 
})
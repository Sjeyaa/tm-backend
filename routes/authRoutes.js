const express = require("express");
const { registerUser, loginUser, getUserProfile, updateUserProfile } = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

//Auth Routes
router.post("/register",registerUser); //register user
router.post("/login", loginUser); //Login user

//Protected routes
router.get("/profile",protect,getUserProfile)  //Get User profile
router.put("/profile",protect,updateUserProfile); //Update user profile

//upload profile image
router.post("/upload-image", upload.single("image"), (req,res) => {
    try {
        if(!req.file){
            return res.status(400).json({ success : false, message : "No file uploaded"});
        }

        const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        res.status(200).json({ success : true, message : "Image uploaded successfully!", imageUrl});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
});

module.exports = router;
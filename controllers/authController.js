const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

//Generate jwt token
const generateToken = (userId) => {
    return jwt.sign({ id : userId}, process.env.JWT_SECRET, { expiresIn : "7d"} )
}

//register user - /api/auth/register --post
const registerUser = async(req,res) => {
    try {
        const { name , email , password , profileImageUrl , adminInviteToken } = req.body;

        //Check if user already exists
        const existingUser = await User.findOne({ email });
        if(existingUser){
            return res.status(400).json({ success : false, message : "User already exists"});
        }

        let role = "member";
        if(adminInviteToken && adminInviteToken === process.env.ADMIN_INVITE_TOKEN){
            role = "admin";
        }

        //Hash password 
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);

        //Create new user
        const userData = await User.create({
            name,
            email,
            password: hashedPassword,
            profileImageUrl,
            role,
        });

        res.status(201).json({ success : true , user : userData, token : generateToken(userData._id), message : "Registred successfully!"});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//login user - /api/auth/login --post
const loginUser = async(req,res) => {
    try {
        const { email , password} = req.body;

        //check user exists
        const user = await User.findOne({ email });
        if(!user){
            return res.status(401).json({ success : false, message : "Invalid email please check email"});
        }

        //Compare password 
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.status(401).json({ success : false , message : "Invalid password"});
        }

        //Return response
        res.status(200).json({ success : true, user : user, token : generateToken(user._id), message : "Login successfully!"});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
}

//get user profile - /api/auth/profile --get
const getUserProfile = async(req,res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if(!user){
            return res.status(404).json({ success : false , message : "User not found"});
        }

        res.status(200).json({ success : true, user : user, message : "Profile details retrieved successfully!"});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
}

//update user profile - /api/auth/profile --put 
const updateUserProfile = async(req,res) => {
    try {
        const user = await User.findById(req.user.id);

        if(!user){
            return res.status(404).json({ success : false , message : "User not found"});
        }

        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        
        if(req.body.password){
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.password,salt);
        }

        const updatedUser = await user.save();

        res.status(200).json({ 
            success : true, 
            user :{ 
                _id : updatedUser._id,
                name : updatedUser.name,
                email : updatedUser.email,
                role : updatedUser.role
            }, 
            token : generateToken(updatedUser._id),
            message : "Details updated successfully!"
        }) 
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
}

module.exports = { registerUser , loginUser , getUserProfile , updateUserProfile};
const jwt = require("jsonwebtoken");
const User = require('../models/User');

//Middleware to protect routes
const protect = async(req,res,next) => {
    try {
        let token = req.headers.authorization;

        if(token && token.startsWith("Bearer")){
            token = token.split(" ")[1];  //Extract token
            const decoded = jwt.verify(token,process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            next();
        } else {
            res.status(401).json({ success : false , message : "Unauthorized, no token provided"});
        }
    } catch (error) {
        res.status(401).json({ success : false, message : "Token failed", error : error.message });
    }
};

//Middleware for Admin-only access 
const adminOnly = (req,res,next) => {
    try {
        if(req.user && req.user.role === "admin"){
            next();
        }
        else{
            res.status(403).json({ success : false , message : "Access denied, admin only"});
        }
    } catch (error) {
        res.status(500).json({ success : false , message : error.message});
    }
}

module.exports = { protect , adminOnly };
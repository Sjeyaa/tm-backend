const Task = require('../models/Task');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

//Get all users - /api/users/ --get (Admin only)
const getUsers = async(req,res) => {
    try {
        const users = await User.find({ role : 'member'}).select("-password");

        //Add task counts to each user
        const usersWithTaskCounts = await Promise.all(users.map( async(user) => {
            const pendingTasks = await Task.countDocuments({ assignedTo: user._id,status : "Pending"});
            const inProgressTasks = await Task.countDocuments({ assignedTo : user._id,status : "In Progress"});
            const completedTasks = await Task.countDocuments({ assignedTo : user._id, status : "Completed"});

            return {
                ...user._doc,
                pendingTasks,
                inProgressTasks,
                completedTasks
            };
        }));

        // if(usersWithTaskCounts.length === 0){
        //     return res.status(404).json({ success : false, message : "No users found"});
        // }

        res.status(200).json({ success : true, data : usersWithTaskCounts , message : "User data retrieved successfully!"});

    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Get a single user by id - /api/users/:id --get
const getUserById = async(req,res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");

        if(!user){
            return res.status(404).json({ success : false ,message : "User not found"});
        }
        res.status(200).json({ success : true, message : "User retrieved successfully", data : user});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

// //Delete a user by id - /api/users/:id -- delete (Admin Only)
// const deleteUser = async(req,res) => {
//     try {
        
//     } catch (error) {
//         res.status(500).json({ success : false, message : "Server Error", error : error.message});
//     }
// };


module.exports = { getUsers, getUserById};
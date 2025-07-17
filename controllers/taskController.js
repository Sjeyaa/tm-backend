const Task = require("../models/Task");

// Get all tasks (Admin : all,User : only assigned) - /api/tasks/ --get
const getTasks = async(req,res) => {
    try {
        const { status } = req.query;
        let filter = {};

        if(status){
            filter.status = status;
        }

        let tasks;

        if(req.user.role === "admin"){
            tasks = await Task.find(filter).populate(
                "assignedTo",
                "name email profileImageUrl"
            );
        } else {
            tasks = await Task.find({ ...filter, assignedTo : req.user._id}).populate(
                "assignedTo",
                "name email profileImageUrl"
            );
        }

        //Add completed todoChecklist count to each task
        tasks = await Promise.all(
            tasks.map(async (task) => {
                const completedCount = task.todoChecklist.filter(
                    (item) => item.completed
                ).length;
                return { ...task._doc, completedTodoCount : completedCount};
            })
        );

        //status summary counts
        const filterByUser = req.user.role === 'admin' ? { } : { assignedTo: req.user._id };

        const allTasks = await Task.countDocuments(filterByUser);

        const pendingTasks = await Task.countDocuments({
            ...filter,
            status: "Pending",
            ...(req.user.role !== 'admin' && { assignedTo : req.user._id}),
        });

        const inProgressTasks = await Task.countDocuments({
            ...filter,
            status: "In Progress",
            ...(req.user.role !== 'admin' && { assignedTo : req.user._id})
        });

        const completedTasks = await Task.countDocuments({
            ...filter,
            status: "Completed",
            ...(req.user.role !== 'admin' && { assignedTo : req.user._id})
        });

        res.status(200).json({
            success : true,
            message : "Tasks retrieved successfully!",
            tasks,
            statusSummary : {
                allTasks,
                pendingTasks,
                inProgressTasks,
                completedTasks
            }
        });
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Get task by id - /api/tasks/:id --get
const getTaskById = async(req,res) => {
    try {
        const task = await Task.findById(req.params.id).populate(
            "assignedTo",
            "name email profileImageUrl"
        );

        if(!task){
            return res.status(404).json({ success : false, message : "Task not found"});
        }

        res.status(200).json({ success : true, message : "Task retrieved successfully!", task});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Create task (Admin) - /api/tasks --post
const createTask = async(req,res) => {
    try {
        const { title, description, priority, dueDate, assignedTo, attachments, todoChecklist } = req.body;

        if(!Array.isArray(assignedTo)){
            return res.status(400).json({ success : false, message : "AssignedTo must be an array of user IDs"});
        }

        const task = await Task.create({
            title,
            description,
            priority,
            dueDate,
            assignedTo,
            createdBy : req.user._id,
            todoChecklist,
            attachments
        });

        res.status(201).json({ success : true, message : "Task created successfully!", task});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Update task - /api/tasks/:id --put
const updateTask = async(req,res) => {
    try {
        const task = await Task.findById(req.params.id);

        if(!task){
            return res.status(404).json({ success : false, message : "Task not found"});
        }

        task.title = req.body.title || task.title;
        task.description = req.body.description || task.description;
        task.priority = req.body.priority || task.priority;
        task.dueDate = req.body.dueDate || task.dueDate;
        task.todoChecklist = req.body.todoChecklist || task.todoChecklist;
        task.attachments = req.body.attachments || task.attachments;

        if(req.body.assignedTo){
            if(!Array.isArray(req.body.assignedTo)){
                return res.status(400).json({ success : false, message : "AssignedTo must be an array of user IDs"});
            }
            task.assignedTo = req.body.assignedTo;
        }
        
        const updatedTask = await task.save();
        res.status(200).json({ success : true, message : "Task updated successfully!", updatedTask});

    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Delete task (Admin) - /api/tasks/:id --delete
const deleteTask = async(req,res) => {
    try {
        const task = await Task.findById(req.params.id);

        if(!task){
            return res.status(404).json({ success : false, message : "Task not found"});
        }

        await task.deleteOne();
        res.status(200).json({ success : true, message : "Task deleted successfully!"});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Update task status -/api/tasks/:id/status --put
const updateTaskStatus = async(req,res) => {
    try {
        let task = await Task.findById(req.params.id);

        if(!task){
            return res.status(404).json({ success : false, message : "Task not found"});
        }

        const isAssigned = task.assignedTo.some((userId) => {
            return userId.toString() === req.user._id.toString();
        });


        if(!isAssigned && req.user.role !== 'admin'){
            return res.status(403).json({ success : false, message : "Not authorized"});
        }
        //685f903c5ca01c03621bdaff
        task.status = req.body.status;

        if(task.status === "Completed"){
            task.todoChecklist.forEach((item) => (item.completed = true));
            task.progress = 100;
        }

        await task.save();
        res.status(200).json({ success : true, message : "Task status updated successfully!", task});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Update task list - /api/tasks/:id/todo --put
const updateTaskChecklist = async(req,res) => {
    try {
        const { todoChecklist } = req.body;

        let task = await Task.findById(req.params.id);
        if(!task){
            return res.status(404).json({ success : false, message : "Task not found"});
        }


        if(!task.assignedTo.includes(req.user._id) && req.user.role !== "admin"){
            return res.status(403).json({ success : false, message : "Not authorized"});
        }
        task.todoChecklist = todoChecklist;

        //Auto update progress
        const completedCount = task.todoChecklist.filter(
            (item) => item.completed).length
        const totalItems = task.todoChecklist.length;

        task.progress = totalItems > 0 ? Math.round((completedCount / totalItems ) * 100) : 0;

        //Auto mark as completed
        if(task.progress === 100) {
            task.status = "Completed";
        }
        else if(task.progress > 0){
            task.status = "In Progress";
        }
        else {
            task.status = "Pending";
        }

        await task.save();
        const updatedTask = await Task.findById(req.params.id).populate(
            "assignedTo",
            "name email profileImageUrl"
        );

        res.status(200).json({ success : true, message : "Task checklist updated successfully!", task : updatedTask});
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//Dashboard data (Admin) - /api/tasks/dashboard-data --get
const getDashboardData = async(req,res) => {
    try {

        console.log(req.user.role);
        //Fetch statistics
        const totalTasks = await Task.countDocuments();
        const pendingTasks = await Task.countDocuments({ status : "Pending"});
        const completedTasks = await Task.countDocuments({ status : "Completed"});
        const overdueTasks = await Task.countDocuments({
            status : { $ne : "Completed"},
            dueDate : { $lt : new Date()}
        });

        //Ensure all possible statuses are included
        const taskStatuses = ["Pending","In Progress","Completed"];
        const taskDistributionRaw = await Task.aggregate([
            {
                $group : {
                    _id : "$status",
                    count : { $sum: 1}
                },
            },
        ]);

        const taskDistribution = taskStatuses.reduce((acc,status) => {
            const formattedKey = status.replace(/\s+/g,""); //Remove white spaces
            acc[formattedKey] = taskDistributionRaw.find((item) => item._id === status)?.count || 0;
            return acc;
        }, {});

        taskDistribution["All"] = totalTasks; //Add total count to distribution

        //Ensure all priority levels are included
        const taskPriorities = ["Low","Medium","High"];
        const taskPriorityLevelRaw = await Task.aggregate([
            {
                $group : {
                    _id : "$priority",
                    count : { $sum : 1},
                },
            },
        ]);

        const taskPriorityLevels = taskPriorities.reduce((acc,priority) => {
            acc[priority] = taskPriorityLevelRaw.find((item) => item._id === priority)?.count || 0;
            return acc;
        }, {});

        //Fetch recent 10 tasks
        const recentTasks = await Task.find()
            .sort({ createdAt : -1})
            .limit(10)
            .select("title status priority deuDate createdAt");

        res.status(200).json({
            success : true,
            message : "Dashboard details fetched successfully!",
            statistics : {
                totalTasks,
                pendingTasks,
                completedTasks,
                overdueTasks
            },
            charts : {
                taskDistribution,
                taskPriorityLevels
            },
            recentTasks
        });
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};

//User Dashboard - /api/tasks/user-dashboard-data --get
const getUserDashboardData = async(req,res) => {
    try {
        
    } catch (error) {
        res.status(500).json({ success : false, message : "Server Error", error : error.message});
    }
};


module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    updateTaskChecklist,
    getDashboardData,
    getUserDashboardData
};

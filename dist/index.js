"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import required modules
require("dotenv").config();
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
var cors = require("cors");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
// Create an Express application
const app = (0, express_1.default)();
app.use(cors());
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
// Create a new instance of Socket.IO and pass the server instance
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
const prisma = new client_1.PrismaClient();
app.get("/user", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userEmail = req.query.email;
    const userExists = yield prisma.user.findUnique({
        where: {
            email: userEmail,
        },
    });
    if (userExists) {
        console.log("User exists");
        res.send(true);
    }
    else {
        console.log("User does not exist");
        res.send(false);
    }
}));
//add friend
app.post("/friend/request", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fromUserName, toUserName } = req.body;
    const fromUser = yield prisma.user.findFirst({
        where: { username: fromUserName },
    });
    const toUser = yield prisma.user.findFirst({
        where: { username: toUserName },
    });
    const friendRequestExists = yield prisma.friendRequest.findFirst({
        where: {
            AND: [
                {
                    sender: {
                        username: fromUserName,
                    },
                },
                {
                    receiver: {
                        username: toUserName,
                    },
                },
            ],
        },
    });
    if (friendRequestExists) {
        console.log("Friend request already exists");
        res
            .send({ message: "Friend request already exists", exists: true })
            .status(400);
    }
    else if (fromUser && toUser) {
        const friendRequest = yield prisma.friendRequest.create({
            data: {
                senderId: fromUser.id,
                receiverId: toUser.id,
            },
        });
        if (friendRequest) {
            console.log("Friend request sent successfully");
            res
                .send({ message: "Friend request sent successfully", friendRequest })
                .status(200);
        }
    }
}));
//show friend requests
app.get("/friend/requests", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const username = req.query.username;
    console.log("username is " + username);
    try {
        const users = yield prisma.friendRequest.findMany({
            where: {
                receiver: {
                    username,
                },
            },
            select: {
                status: true,
                id: true,
                sender: {
                    select: {
                        username: true,
                        picture: true,
                        id: true,
                    },
                },
                receiver: {
                    select: {
                        username: true,
                        picture: true,
                        id: true,
                    },
                },
            },
        });
        console.log(users);
        res.send({
            message: "Recieved Requests",
            requests: users,
        });
    }
    catch (e) {
        console.log(e);
        res.send({ message: "Error fetching requests" }).status(500);
    }
}));
//accept friend request
//accept friend request
app.post("/friend/accept", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { senderId, receiverId, requestId } = req.body;
    if (!senderId || !receiverId || !requestId) {
        return res.status(400).send({ message: "Missing required fields" });
    }
    try {
        // Update friend request status
        const friendRequest = yield prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: "accepted" },
            include: { sender: true, receiver: true },
        });
        // Check if the friend entries already exist
        const friendExists = yield prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: senderId, friendId: receiverId },
                    { userId: receiverId, friendId: senderId },
                ],
            },
        });
        if (!friendExists) {
            // Add bidirectional friendship
            yield prisma.friend.createMany({
                data: [
                    { userId: senderId, friendId: receiverId },
                    { userId: receiverId, friendId: senderId },
                ],
            });
        }
        res.status(200).send({
            message: "Friend request accepted and friends added",
            friendRequest,
        });
    }
    catch (e) {
        console.error("Error accepting friend request:", e);
        res.status(500).send({ message: "Error accepting friend request" });
    }
}));
app.get("/users/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const username = req.query.username;
    const selfUsername = req.query.selfUsername;
    console.log("username is " + username);
    console.log("self username is " + selfUsername);
    try {
        const users = yield prisma.user.findMany({
            where: {
                username: {
                    contains: username,
                    mode: "insensitive",
                },
                NOT: {
                    username: selfUsername,
                },
            },
            select: {
                username: true,
                picture: true,
            },
        });
        console.log("Users fetched successfully");
        res.status(200).send(users);
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ message: "Error fetching users" });
    }
}));
//show friends
app.get("/user/friends", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).send({ message: "User ID is required" });
    }
    try {
        const friends = yield prisma.friend.findMany({
            where: {
                userId: Number(userId),
            },
            select: {
                friend: {
                    select: {
                        username: true,
                        picture: true,
                        id: true,
                        name: true,
                    },
                },
            },
        });
        const formattedFriends = friends.map((friend) => friend.friend); // Extract the friend details
        res.status(200).send({
            message: "Friends fetched successfully",
            friends: formattedFriends,
        });
    }
    catch (e) {
        console.error("Error fetching friends:", e);
        res.status(500).send({ message: "Error fetching friends" });
    }
}));
app.get("/user/details", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.query.email;
    try {
        const userDetails = yield prisma.user.findUnique({
            where: {
                email: email,
            },
        });
        console.log("User details fetched successfully");
        res.send(userDetails).status(200);
    }
    catch (err) {
        console.log(err);
        res.send({ message: "Error fetching user details" }).status(500);
    }
}));
app.post("/createUser", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.body.email;
    const name = req.body.name;
    const picture = req.body.picture;
    let randomNumber = Math.floor(Math.random() * 1000);
    let userName = name.split(" ")[0].toLowerCase() + randomNumber;
    const userNameExists = yield prisma.user.findFirst({
        where: {
            username: userName,
        },
    });
    if (userNameExists) {
        randomNumber = Math.floor(Math.random() * 1000 + 1);
        userName = name.split(" ")[0].toLowerCase() + randomNumber;
    }
    try {
        const user = yield prisma.user.create({
            data: {
                picture: picture,
                email: email,
                name: name,
                username: userName,
            },
        });
        console.log("User created successfully");
        res.send({ message: "User created successfully", user: user }).status(200);
    }
    catch (e) {
        console.log(e);
        console.log("Error creating user");
        res.send({ message: "Error creating user" }).status(500);
    }
}));
app.post("/create/message", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const message = req.body.message;
    const userName = req.body.userName;
    const roomName = req.body.roomName;
    console.log("create/message body:", req.body);
    const time = req.body.time;
    try {
        const chat = yield prisma.chat.create({
            data: {
                message,
                userName,
                roomName,
                time,
            },
        });
        res.status(200).send({ message: "Message created successfully", chat });
    }
    catch (e) {
        console.log("Prisma error", e);
        res.status(500).send({ message: "Error creating message" });
    }
}));
app.get("/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const roomName = req.query.roomName;
    try {
        const chats = yield prisma.chat.findMany({
            where: {
                roomName,
            },
        });
        res.send({ message: "Messages fetched successfully", chats }).status(200);
    }
    catch (e) {
        console.log(e);
        res.send({ message: "Error fetching messages" }).status(500);
    }
}));
// Socket.IO event listeners
io.on("connection", (socket) => {
    console.log("User connected");
    socket.on("message", (message, roomName, id, currentTime, userName) => {
        io.to(roomName).emit("message", message, id, currentTime, userName);
        console.log(message);
    });
    socket.on("joinRoom", (roomName) => {
        console.log("Joining room: " + roomName);
        socket.join(roomName);
    });
    socket.on("enter", (roomName, userName) => {
        console.log(userName + " entered room: " + roomName);
        io.to(roomName).emit("enter", userName);
    });
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});
app.post("/friend/remove", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const myUserName = req.body.myUserName;
    const friendUserName = req.body.friendUserName;
    try {
        const removeFriend = prisma.friend.deleteMany({
            where: {
                OR: [
                    {
                        user: {
                            username: myUserName,
                        },
                        friend: {
                            username: friendUserName,
                        },
                    },
                    {
                        user: {
                            username: friendUserName,
                        },
                        friend: {
                            username: myUserName,
                        },
                    },
                ],
            },
        });
        res.json({ message: "Friend removed", removeFriend });
    }
    catch (err) {
        console.log("Error deleting friend", err);
    }
}));
// Start the server
const PORT = parseInt(process.env.PORT) || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

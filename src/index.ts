// Import required modules
require("dotenv").config();
import express from "express";
import http from "http";
var cors = require("cors");

import { Server as SocketIOServer, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
// Create an Express application
const app = express();
app.use(cors());

app.use(express.json());

const server = http.createServer(app);

// Create a new instance of Socket.IO and pass the server instance
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const prisma = new PrismaClient();

app.get("/user", async (req, res) => {
  const userEmail = req.query.email as string;
  const userExists = await prisma.user.findUnique({
    where: {
      email: userEmail,
    },
  });

  if (userExists) {
    console.log("User exists");
    res.send(true);
  } else {
    console.log("User does not exist");
    res.send(false);
  }
});

//add friend
app.post("/friend/request", async (req, res) => {
  const { fromUserName, toUserName } = req.body;
  const fromUser = await prisma.user.findFirst({
    where: { username: fromUserName },
  });
  const toUser = await prisma.user.findFirst({
    where: { username: toUserName },
  });

  const friendRequestExists = await prisma.friendRequest.findFirst({
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
  } else if (fromUser && toUser) {
    const friendRequest = await prisma.friendRequest.create({
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
});

//show friend requests
app.get("/friend/requests", async (req, res) => {
  const username = req.query.username as string;
  console.log("username is " + username);
  try {
    const users = await prisma.friendRequest.findMany({
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
  } catch (e) {
    console.log(e);
    res.send({ message: "Error fetching requests" }).status(500);
  }
});

//accept friend request
//accept friend request
app.post("/friend/accept", async (req, res) => {
  const { senderId, receiverId, requestId } = req.body;

  if (!senderId || !receiverId || !requestId) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  try {
    // Update friend request status
    const friendRequest = await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "accepted" },
      include: { sender: true, receiver: true },
    });

    // Check if the friend entries already exist
    const friendExists = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: senderId, friendId: receiverId },
          { userId: receiverId, friendId: senderId },
        ],
      },
    });

    if (!friendExists) {
      // Add bidirectional friendship
      await prisma.friend.createMany({
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
  } catch (e) {
    console.error("Error accepting friend request:", e);
    res.status(500).send({ message: "Error accepting friend request" });
  }
});

app.get("/users/search", async (req, res) => {
  const username = req.query.username as string;
  const selfUsername = req.query.selfUsername as string;
  console.log("username is " + username);
  console.log("self username is " + selfUsername);
  try {
    const users = await prisma.user.findMany({
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
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Error fetching users" });
  }
});

//show friends
app.get("/user/friends", async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).send({ message: "User ID is required" });
  }

  try {
    const friends = await prisma.friend.findMany({
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
  } catch (e) {
    console.error("Error fetching friends:", e);
    res.status(500).send({ message: "Error fetching friends" });
  }
});

app.get("/user/details", async (req, res) => {
  const email = req.query.email as string;
  try {
    const userDetails = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    console.log("User details fetched successfully");
    res.send(userDetails).status(200);
  } catch (err) {
    console.log(err);
    res.send({ message: "Error fetching user details" }).status(500);
  }
});
app.post("/createUser", async (req, res) => {
  const email = req.body.email;
  const name = req.body.name;
  const picture = req.body.picture;

  let randomNumber = Math.floor(Math.random() * 1000);
  let userName = name.split(" ")[0].toLowerCase() + randomNumber;

  const userNameExists = await prisma.user.findFirst({
    where: {
      username: userName,
    },
  });

  if (userNameExists) {
    randomNumber = Math.floor(Math.random() * 1000 + 1);
    userName = name.split(" ")[0].toLowerCase() + randomNumber;
  }
  try {
    const user = await prisma.user.create({
      data: {
        picture: picture,
        email: email,
        name: name,
        username: userName,
      },
    });
    console.log("User created successfully");
    res.send({ message: "User created successfully", user: user }).status(200);
  } catch (e) {
    console.log(e);
    console.log("Error creating user");
    res.send({ message: "Error creating user" }).status(500);
  }
});

app.post("/create/message", async (req, res) => {
  const message = req.body.message;
  const userName = req.body.userName;
  const roomName = req.body.roomName;
  console.log("create/message body:", req.body);
  const time = req.body.time;
  try {
    const chat = await prisma.chat.create({
      data: {
        message,
        userName,
        roomName,
        time,
      },
    });
    res.status(200).send({ message: "Message created successfully", chat });
  } catch (e) {
    console.log("Prisma error", e);
    res.status(500).send({ message: "Error creating message" });
  }
});

app.get("/messages", async (req, res) => {
  const roomName = req.query.roomName as string;
  try {
    const chats = await prisma.chat.findMany({
      where: {
        roomName,
      },
    });
    res.send({ message: "Messages fetched successfully", chats }).status(200);
  } catch (e) {
    console.log(e);
    res.send({ message: "Error fetching messages" }).status(500);
  }
});

// Socket.IO event listeners
io.on("connection", (socket: Socket) => {
  console.log("User connected");

  socket.on(
    "message",
    (
      message: string,
      roomName: string,
      id: string,
      currentTime: string,
      userName: string
    ) => {
      io.to(roomName).emit("message", message, id, currentTime, userName);
      console.log(message);
    }
  );

  socket.on("joinRoom", (roomName: string) => {
    console.log("Joining room: " + roomName);
    socket.join(roomName);
  });

  socket.on("enter", (roomName: string, userName: string) => {
    console.log(userName + " entered room: " + roomName);
    io.to(roomName).emit("enter", userName);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.post("/friend/remove", async (req, res) => {
  const myUserName = req.body.myUserName as string;
  const friendUserName = req.body.friendUserName as string;
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
    res.json({ message: "Friend removed",removeFriend });
  } catch (err) {
    console.log("Error deleting friend", err);
  }
});

// Start the server
const PORT: number = parseInt(process.env.PORT as string) || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const express = require("express");
const MQTT = require("mqtt");
const path = require("path");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config({ path: ".env" });

const app = express();
const PORT = 3000;

const prisma = new PrismaClient();

app.use(express.json());

app.use(cors());

const MQTT_PORT = process.env.MQTT_PORT;
const CONNECTURL = `mqtt://${process.env.MQTT_HOST}:${MQTT_PORT}`;
const ACTION_TOPIC = "stt/action";
const SUBSCRIBE_TOPIC = "stt/status";

const client = MQTT.connect(CONNECTURL, {
  clientId: process.env.CLIENT_ID,
  clean: true,
  connectTimeout: 7200,
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 10000,
});

client.on("error", function (error) {
  console.log("Can't connect: " + error);
});

client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe(SUBSCRIBE_TOPIC, (err) => {
    if (err) {
      console.log("Failed to subscribe:", err);
    } else {
      console.log(`Subscribed to topic '${SUBSCRIBE_TOPIC}'`);
    }
  });
});

client.on("message", (topic, message) => {
  if (topic === SUBSCRIBE_TOPIC) {
    console.log(
      `Received message from '${SUBSCRIBE_TOPIC}': ${message.toString()}`
    );
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.post("/publish", (req, res) => {
  const { message } = req.body;

  if (message) {
    publishMessage(ACTION_TOPIC, message, res);
  }
});

function publishMessage(topic, message, res) {
  client.publish(topic, message, { qos: 0, retain: false }, (error) => {
    if (error) {
      console.log("Failed to publish message:", error.message);
      return res.status(500).send("Failed to publish message");
    }
    console.log(`Message '${message}' published to TOPIC '${topic}'`);
    res.send(`Message '${message}' sent to topic`);
  });
}

app.get("/api/status", async (req, res) => {
  try {
    const data = await prisma.sTT030.findFirst({
      where: {
        id: 1,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
  }
});

app.put("/api/update", async (req, res) => {
  const { temp, status } = req.body;

  try {
    const data = await prisma.sTT030.updateMany({
      where: {
        id: 1,
      },
      data: {
        temp: temp,
        status: status,
        updated_at: new Date(),
      },
    });

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
  }
});

app.put("/api/system", async (req, res) => {
  const { system_on } = req.body;

  try {
    const updatedRow = await prisma.sTT030.updateMany({
      where: {
        id: 1,
      },
      data: {
        system_on: system_on,
      },
    });

    res
      .status(200)
      .json({ message: "Power status updated successfully.", updatedRow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update power status" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(
  process.env.FIREBASE_ADMIN_KEY_BASE64,
  "base64",
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  console.log(`jy man${req.method} ${req.url}`);
  next();
};

const extractAuthToken = (authorizationHeader = "") => {
  const rawValue = authorizationHeader.trim().replace(/^"|"$/g, "");
  const bearerMatch = rawValue.match(/^Bearer\s+(.+)$/i);

  return bearerMatch ? bearerMatch[1].trim() : rawValue;
};

const verifyFBToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      message: "Unauthorized access. Missing Authorization header.",
    });
  }

  const token = extractAuthToken(authorization);

  if (!token) {
    return res.status(401).send({
      message: "Unauthorized access. Token is missing in Authorization header.",
    });
  }

  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    req.decoded = userInfo;
    return next();
  } catch (error) {
    console.error("Token verification failed:", error.code || error.message);
    return res.status(401).send({
      message:
        "Invalid token. Please login again to refresh your Firebase ID token.",
    });
  }
};

// const uri =
//   "mongodb+srv://smartDBuser:FxCo0vt4bBsTSwZ6@cluster0.1ezipje.mongodb.net/?appName=Cluster0";

const uri =
  "mongodb+srv://smartDBuser:FxCo0vt4bBsTSwZ6@cluster0.1ezipje.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("smart_db");
const productsCollection = db.collection("products");
const bidsCollection = db.collection("bids");
const usersCollection = db.collection("users");
let isDbConnected = false;

const requireDbConnection = (req, res, next) => {
  if (!isDbConnected) {
    return res
      .status(503)
      .send({ message: "Database is unavailable. Please try again soon." });
  }

  next();
};

app.use("/users", requireDbConnection);
app.use("/products", requireDbConnection);
app.use("/latest-products", requireDbConnection);
app.use("/bids", requireDbConnection);

//all Api of smartDBuser database are here
// user related api
app.post("/users", async (req, res) => {
  try {
    const newUser = req.body;
    const email = req.body.email;
    const query = { email: email };
    const existingUser = await usersCollection.findOne(query);
    if (existingUser) {
      return res.status(400).send({ message: "User already exists" });
    }
    const result = await usersCollection.insertOne(newUser);
    res.send(result);
  } catch (error) {
    console.error("Failed to insert user:", error);
    res.status(500).send({ message: "Failed to add user" });
  }
});

app.get("/users",verifyFBToken, async (req, res) => {
  try {
    const query = {};
    const email = req.query.email;
    if (email) {
      query.email = email;
    }
    const users = await usersCollection.find(query);
    const result = await users.toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).send({ message: "Failed to load users" });
  }
});

//jwt releted api
app.post("/getToken", async (req, res) => {
  try {
    const email = req.body.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);
    if (user) {
      const loggedUser = req.body;
      const token = jwt.sign(loggedUser, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      return res.send({ accessToken: token });
    } else {
      return res.status(403).send({ message: "Forbidden access" });
    }
  } catch (error) {
    console.error("Failed to generate JWT:", error);
    res.status(500).send({ message: "Failed to generate token" });
  }
});

//products releted API
app.post("/products", verifyFBToken, async (req, res) => {
  try {
    const newProduct = req.body;
    const result = await productsCollection.insertOne(newProduct);
    res.send(result);
  } catch (error) {
    console.error("Failed to insert product:", error);
    res.status(500).send({ message: "Failed to add product" });
  }
});

app.get("/products", async (req, res) => {
  try {
    const query = {};
    const queryKeys = Object.keys(req.query);
    const keyOnlyEmail = queryKeys.find((key) => key.includes("@"));
    const email = req.query.email || req.query.sellerEmail || keyOnlyEmail;

    if (email) {
      query.$or = [{ email }, { sellerEmail: email }];
    }

    const products = await productsCollection.find(query);
    const result = await products.toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    res.status(500).send({ message: "Failed to load products" });
  }
});

app.get("/latest-products", verifyFBToken,async (req, res) => {
  try {
    const products = await productsCollection.find().sort({ _id: -1 }).limit(6);
    const result = await products.toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch latest products:", error);
    res.status(500).send({ message: "Failed to load latest products" });
  }
});

app.get("/products/:id",verifyFBToken, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const product = await productsCollection.findOne(query);
    if (product) {
      res.send(product);
    } else {
      res.status(404).send({ message: "Product not found" });
    }
  } catch (error) {
    console.error("Failed to fetch product:", error);
    res.status(500).send({ message: "Failed to load product" });
  }
});

app.patch("/products/:id", verifyFBToken, async (req, res) => {
  try {
    const id = req.params.id;
    const updatedProduct = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedProduct };
    const result = await productsCollection.updateOne(query, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Failed to update product:", error);
    res.status(500).send({ message: "Failed to update product" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await productsCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error("Failed to delete product:", error);
    res.status(500).send({ message: "Failed to delete product" });
  }
});

//bids releted API
app.get("/bids", logger, verifyFBToken, async (req, res) => {
  console.log("Decoded token email:", req.token_email);
  try {
    console.log("headers", req.headers);
    const email = req.query.email;
    const query = email ? { email } : {};
    const cursor = await bidsCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    console.error("Failed to fetch bids:", error);
    res.status(500).send({ message: "Failed to load bids" });
  }
});

app.post("/bids",verifyFBToken, async (req, res) => {
  try {
    const newBid = req.body;
    const result = await bidsCollection.insertOne(newBid);
    res.send(result);
  } catch (error) {
    console.error("Failed to insert bid:", error);
    res.status(500).send({ message: "Failed to add bid" });
  }
});

app.delete("/bids/:id", verifyFBToken, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await bidsCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error("Failed to delete bid:", error);
    res.status(500).send({ message: "Failed to delete bid" });
  }
});

app.patch("/bids/:id", verifyFBToken, async (req, res) => {
  try {
    const id = req.params.id;
    const updatedBid = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedBid };
    const result = await bidsCollection.updateOne(query, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Failed to update bid:", error);
    res.status(500).send({ message: "Failed to update bid" });
  }
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    isDbConnected = true;
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
  } catch (error) {
    isDbConnected = false;
    console.error(
      "MongoDB connection failed. Server is running in degraded mode:",
      error.message,
    );
  }
}

run();

app.get("/", (req, res) => {
  res.send("Smart Server is Running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

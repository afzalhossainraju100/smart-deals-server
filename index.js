const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://smartDBuser:BtfbYZRDxX6hI46E@cluster0.1ezipje.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("smart_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");

    //all Api of smartDBuser database are here

    app.post("/products", async (req, res) => {
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

    app.get("/products/:id", async (req, res) => {
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

    app.patch("/products/:id", async (req, res) => {
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
    app.get("/bids", async (req, res) => {
      try {
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

    app.post("/bids", async (req, res) => {
        try {
            const newBid = req.body;
            const result = await bidsCollection.insertOne(newBid);
            res.send(result);
        } catch (error) {
            console.error("Failed to insert bid:", error);
            res.status(500).send({ message: "Failed to add bid" });
        }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Smart Server is Running");
});

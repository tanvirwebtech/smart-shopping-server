const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri =
    "mongodb+srv://smart-shopping:bk40pWol3FyfBdkM@cluster0.uhu2y.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
async function run() {
    try {
        await client.connect();
        console.log("db connected");
        const database = client.db("smart_shopping");
        const products = database.collection("smart_products");
        const users = database.collection("smart_users");
        const Ids = database.collection("smart_Ids");
        // Ids.insertOne({ userIdBase: 10000 });

        app.get("/products", async (req, res) => {
            const allProducts = products.find({});
            const result = await allProducts.toArray();
            res.json(result);
        });
        app.get("/products/:id", async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            const findProduct = await products.findOne(query);
            res.json(findProduct);
        });

        // POST METHODS
        app.post("/registerUser", async (req, res) => {
            const user = req.body;
            const result = await users.insertOne(user);
            res.send(result);
        });
    } finally {
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("server connected");
});

app.listen(port, () => {
    console.log("server opened at port", port);
});

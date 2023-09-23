const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const port = 5000;

const corsOptions = {
    origin: process.env.CLIENT_ORIGIN,
    credentials: true, //access-control-allow-credentials:true
    optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uhu2y.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect((error) => {
            if (error) {
                console.log(error);
                return;
            }
        });

        // await client.connect();
        console.log("db connected");
        const database = client.db("smart_shopping");
        const products = database.collection("smart_products");
        const users = database.collection("smart_users");
        const carts = database.collection("smart_carts");
        const orders = database.collection("smart_orders");
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
        // GET PROFILE
        app.get("/getUsers/:email", async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const findUser = await users.findOne(query);
            if (findUser) {
                const data = {
                    db_id: findUser._id,
                    name: findUser.name,
                    shippingAddress: findUser.shippingAddress,
                    billingAddress: findUser.billingAddress,
                    email: findUser.email,
                    phone: findUser.phone,
                };
                res.json(data);
            } else {
                res.status(404).json("not found");
            }
        });

        app.get("/getCart/:email", async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            const findCart = await carts.findOne(query);
            if (findCart !== null) {
                res.json(findCart?.cart);
            } else {
                res.json([]);
            }
        });
        app.get("/orders", async (req, res) => {
            const allOrders = orders.find({});
            const result = await allOrders.toArray();
            res.json(result);
        });

        // POST METHODS
        app.post("/registerUser", async (req, res) => {
            const filter = { title: "userIds" };
            const findId = Ids.find({});
            const userIdArray = await findId.toArray();
            const presentId = parseInt(userIdArray[0].lastUserId);
            const userCart = [];
            const userOrders = [];
            // const addresses = [{ shipping: "" }, { billing: "" }];
            const shippingAddress = "";
            const billingAddress = "";
            const userCreatedTime = new Date().toLocaleString("en-US");
            const user = req.body;

            const newUser = {
                userId: presentId,
                userCart,
                billingAddress,
                shippingAddress,
                userOrders,
                userCreatedTime,
                ...user,
            };
            const result = await users.insertOne(newUser);
            if (result) {
                const newId = presentId + 1;
                const updateDoc = {
                    $set: {
                        lastUserId: newId,
                    },
                };
                const idUpdateResult = await Ids.updateOne(filter, updateDoc);
            }
            res.json(result);
        });

        app.post("/addOrder", async (req, res) => {
            const order = req.body;
            const result = await orders.insertOne(order);
            res.json(result);
        });

        // PAYMENT
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            if (price <= 0) {
                res.status(404).send("No data");
                return;
            }
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // PUT METHODS

        // Update Profile
        app.put("/users/:id", async (req, res) => {
            const { id } = req.params;
            const userInfo = req.body;
            const options = { upsert: true };
            const query = { _id: ObjectId(id) };

            const updateDoc = {
                $set: userInfo,
            };
            const result = await users.updateOne(query, updateDoc, options);
            res.json(result);
        });

        app.put("/cart/:email", async (req, res) => {
            // [
            //     {
            //         _id: "",
            //         email: "",
            //         cart: [
            //             { id: "", qty: 1 },   //CART MODEL
            //             { id: "", qty: 1 },
            //         ],
            //     },
            // ];

            const { email } = req.params;

            const cartItem = req.body;

            const options = { upsert: true };
            const query = { email: email };
            const allCarts = carts.find(query);
            const allCartArray = await allCarts.toArray();
            // create a filter for a cart to update

            const filter = { email: email };

            const checkProduct = allCartArray[0]?.cart.find(
                (cartPd) => cartPd.id === cartItem.id
            ); // check if product already exist in cart

            const updateCart = async (cart) => {
                const updateDoc = {
                    $set: {
                        cart: cart,
                    },
                };
                const result = await carts.updateOne(
                    filter,
                    updateDoc,
                    options
                );
                res.json(result);
            };

            // CART FILTER
            if (req.body.del) {
                const fliteredCart = allCartArray[0]?.cart.filter(
                    (pd) => pd.id !== cartItem.id
                );

                updateCart(fliteredCart);
            } else {
                if (checkProduct) {
                    res.send("product exist on cart");
                } else {
                    if (allCartArray[0]?.cart) {
                        const newCartItem = [
                            ...allCartArray[0]?.cart,
                            cartItem,
                        ];
                        updateCart(newCartItem);
                    } else {
                        updateCart([cartItem]);
                    }
                }
            }
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("server connected");
});

app.listen(port, () => {
    console.log("server opened at port", port);
});

const express = require("express");
const app = express();

const unirest = require("unirest");

const cors = require("cors");
const axios = require("axios");

const dotenv = require("dotenv");
dotenv.config();

const pool = require("./database.js");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("welcome");
});

app.get("/access_token", access, (req, res) => {
  res.status(200).json({ access_token: req.access_token });
});

app.get("/register", access, (req, res) => {
  let request = unirest(
    "POST",
    "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl"
  )
    .headers({
      "Content-Type": "application/json",
      Authorization: "Bearer " + req.access_token,
    })
    .send(
      JSON.stringify({
        ShortCode: process.env.SHORT_CODE1,
        ResponseType: "Completed",
        ConfirmationURL: "https://mydomain.com/confirmation",
        ValidationURL: "https://mydomain.com/validation",
        // "ConfirmationURL": "https://197.237.171.106:3000/confirmation",
        // "ValidationURL": "https://197.237.171.106:3000/validation",
      })
    )
    .end((response) => {
      if (response.error) throw new Error(response.error);
      console.log(response.raw_body);
      res.status(200).json(response.raw_body);
    });
});

app.get("/stk", access, async (req, res) => {
  const date = new Date();
  const timestamp =
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);

  const shortcode = process.env.SHORT_CODE2;
  const passkey = process.env.PASS_KEY;

  const password = new Buffer.from(shortcode + passkey + timestamp).toString(
    "base64"
  );
  await axios
    .post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: 1,
        PartyA: process.env.MOBILE_NO,
        PartyB: shortcode,
        PhoneNumber: process.env.MOBILE_NO,
        CallBackURL: "https://847a-197-237-171-106.ngrok-free.app/callback",
        AccountReference: "Cancer Support System",
        TransactionDesc: "Test",
      },
      {
        headers: {
          Authorization: "Bearer " + req.access_token,
        },
      }
    )
    .then((data) => {
      res.status(200).json(data);
      console.log(data);
    })
    .catch((err) => res.status(200).json(err));
});

function access(req, res, next) {
  let request = unirest(
    "GET",
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
  )
    .headers({
      Authorization: "Basic " + process.env.AUTHORIZATION_CODE,
    })
    .send()
    .end((response) => {
      if (response.error) throw new Error(response.error);
      console.log(response.raw_body);
      req.access_token = JSON.parse(response.raw_body).access_token;
      next();
    });
}

app.post("/callback", (req, res) => {
  const callback = req.body;
  console.log(callback.Body);

  if (!callback.Body.stkCallback.CallbackMetadata) {
    console.log("not paid");
    console.log(callback.Body.stkCallback);
    return res.json("ok");
  } else {
    console.log("paid");
    console.log(callback.Body.stkCallback.CallbackMetadata);

    const amount = callback.Body.stkCallback.CallbackMetadata.item[0].Value;
    const transactionId =
      callback.Body.stkCallback.CallbackMetadata.item[1].Value;
    const timestamp = callback.Body.stkCallback.CallbackMetadata.item[2].Value;
    const PhoneNumber =
      callback.Body.stkCallback.CallbackMetadata.item[3].Value;

    pool.getConnection((err, connection) => {
      if (err) throw err;

      const query =
        "INSERT INTO payments(transaction_id, amount, timestamp, phone_no) VALUES(?)";
      const values = [transactionId, amount, timestamp, PhoneNumber];
      connection.query(query, [values], (err, data) => {
        if (err) throw err;
        console.log("Payment Inserted Successfully");
      });
    });
  }
});


let port = process.env.PORT;

app.listen(port, () => console.log("Server listening at port " + port));

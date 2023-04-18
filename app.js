const express = require("express");
const app = express();

const unirest = require("unirest");

const cors = require("cors");
const axios = require("axios");

const dotenv = require("dotenv");
dotenv.config();

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
        PartyB: "174379",
        PhoneNumber: process.env.MOBILE_NO,
        CallBackURL: "https://mydomain.com/pat",
        AccountReference: "Cancer Support System",
        TransactionDesc: "Test",
      },
      {
        headers: {
          Authorization: "Bearer " + req.access_token,
        },
      }
    )
    .then((data) => res.status(200).json(data))
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

let port = process.env.PORT;

app.listen(port, () => console.log("Server listening at port " + port));

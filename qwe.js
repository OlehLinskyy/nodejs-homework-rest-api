require("dotenv").config();

const { response } = require("express");
const nodemailer = require("nodemailer");

const transport = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASSWORD,
  },
});

const message = {
  to: "linskyy@gmail.com",
  from: "linskyy@gmail.com",
  subject: "From Node.js with love",
  html: '<h1 style="color: #ff0000">Node.js is awesome platform</h1>',
  text: "Node.js is awesome platform",
};

transport
  .sendMail(message)
  .then((response) => console.log(response))
  .catch((error) => console.error(error));

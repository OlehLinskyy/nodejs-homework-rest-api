const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");
const path = require("path");
const fs = require("fs/promises");
const Jimp = require("jimp");

const { User } = require("../models/user");

const { ctrlWrapper, HttpError, sendEmail } = require("../helpers");

const { SECRET_KEY, BASE_URL } = process.env;

const avatarsDir = path.join(__dirname, "../", "public", "avatars");

const register = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).exec();

  if (user) {
    throw HttpError(409, "Email in use");
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const avatarURL = gravatar.url(email);

  const verificationToken = crypto.randomUUID();

  const newUser = await User.create({
    ...req.body,
    password: hashPassword,
    avatarURL,
    verificationToken,
  });

  await sendEmail({
    to: email,
    subject: `Welcome on board`,
    html: `
      <p>To confirm your registration, please click on the link below</p>
      <a href="${BASE_URL}/api/users/verify/${verificationToken}">Click me</a>
    `,
    text: `
      To confirm your registration, please click on the link below:\n
      ${BASE_URL}/api/users/verify/${verificationToken}
    `,
  });

  res.status(201).json({
    email: newUser.email,
    name: newUser.name,
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).exec();

  if (!user) {
    throw HttpError(401, "Email or password is wrong");
  }

  if (!user.verified) {
    throw HttpError(401, "Please verify you email");
  }

  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, "Email or password is wrong");
  }

  const payload = {
    id: user._id,
  };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "23h" });
  await User.findByIdAndUpdate(user._id, { token });
  res.json({
    token,
    user: {
      email,
      subscription: user.subscription,
    },
  });
};

const getCurrent = async (req, res) => {
  const { email, name } = req.user;

  res.json({
    email,
    name,
  });
};

const logout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: "" });

  res.status(204).json({});
};

const subscription = async (req, res) => {
  const { _id } = req.user;
  const subscription = req.body;
  const newUser = await User.findByIdAndUpdate(_id, subscription, {
    new: true,
  });
  res.json({
    email: newUser.email,
    subscription: newUser.subscription,
  });
};

const updateAvatar = async (req, res) => {
  const { _id } = req.user;
  const { path: tempUpload, originalname } = req.file;
  const filname = `${_id}_${originalname}`;
  const image = await Jimp.read(tempUpload);
  image.resize(250, 250);
  image.write(tempUpload);
  const resultUpload = path.join(avatarsDir, filname);
  await fs.rename(tempUpload, resultUpload);
  const avatarURL = path.join("avatars", filname);
  await User.findByIdAndUpdate(_id, { avatarURL });
  res.json({
    avatarURL,
  });
};

const verify = async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({ verificationToken: token }).exec();

  if (user === null) {
    return res.status(400).send({ message: "Not Found" });
  }

  await User.findByIdAndUpdate(user.id, {
    verified: true,
    verificationToken: null,
  });

  res.send({ message: "Verification successful" });
};

const newVerify = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ message: "missing required field email" });
  }

  const user = await User.findOne({ email }).exec();

  if (user.verified) {
    throw HttpError(400, "Verification has already been passed");
  }
  await sendEmail({
    to: email,
    subject: `Welcome on board`,
    html: `
      <p>To confirm your registration, please click on the link below</p>
      <a href="${BASE_URL}/api/users/verify/${user.verificationToken}">Click me</a>
    `,
    text: `
      To confirm your registration, please click on the link below:\n
      ${BASE_URL}/api/users/verify/${user.verificationToken}
    `,
  });
  res.status(200).json({ message: "Verification email sent" });
};

module.exports = {
  register: ctrlWrapper(register),
  login: ctrlWrapper(login),
  getCurrent: ctrlWrapper(getCurrent),
  logout: ctrlWrapper(logout),
  subscription: ctrlWrapper(subscription),
  updateAvatar: ctrlWrapper(updateAvatar),
  verify: ctrlWrapper(verify),
  newVerify: ctrlWrapper(newVerify),
};

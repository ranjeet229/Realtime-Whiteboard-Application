const mongoose = require("mongoose");

/**
 * Connects to MongoDB once using MONGODB_URI from .env
 * @returns {Promise<boolean>} true if connected
 */
async function connectDb() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.warn(
      "[db] MONGODB_URI is not set — add it to backend/.env and restart (see .env.example)."
    );
    return false;
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri);
    console.log(
      "[db] MongoDB connected →",
      mongoose.connection.host,
      "/",
      mongoose.connection.name
    );
    return true;
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    console.error(
      "[db] Check: URI in .env, username/password, Atlas IP Access List (0.0.0.0/0 for dev), and cluster status."
    );
    return false;
  }
}

module.exports = { connectDb };

const mongoose = require("mongoose");

/**
 * Private room metadata. Stroke payload is stored as flexible Mixed array
 * (same shape as socket draw events) for snapshot reloads.
 * hostUserId is optional (legacy); new rooms use anonymous host via room JWT only.
 */
const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    passwordHash: { type: String, default: null },
    title: { type: String, default: "Untitled board" },
    strokes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    /** Slide deck: each stroke has optional `pageId` matching an entry here. */
    canvasPages: {
      type: [
        new mongoose.Schema(
          { id: { type: String, required: true }, title: { type: String, default: "Page" } },
          { _id: false }
        ),
      ],
      default: [],
    },
    revision: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Room || mongoose.model("Room", roomSchema);

const mongoose = require("mongoose");

const onboardingSchema = new mongoose.Schema({
  awb: { type: String, required: true, unique: true },
  orderId: { type: String, default: "" },
  customerName: { type: String, default: "" },
  phone: { type: String, default: "" },
  planName: { type: String, default: "" },
  dealId: { type: String, default: "" },
  dealLink: { type: String, default: "" },
  deliveryDate: { type: String, default: "" },
  city: { type: String, default: "" },
  courier: { type: String, default: "" },
  invoiceValue: { type: Number, default: 0 },
  // Staff action tracking
  onboardingStatus: {
    type: String,
    enum: ["pending", "called", "explained", "not_reachable", "follow_up"],
    default: "pending",
  },
  notes: { type: String, default: "" },
  calledBy: { type: String, default: "" },
  calledAt: { type: Date, default: null },
  // Follow-up
  followUpDate: { type: Date, default: null },
  followUpReason: { type: String, default: "" },
  // Dates
  date: { type: String, required: true }, // delivery date (YYYY-MM-DD)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

onboardingSchema.pre("save", function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model("Onboarding", onboardingSchema);

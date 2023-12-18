export default {
  type: "object",
  properties: {
    link: { type: "string" },
    expiresAt: { type: "number" },
  },
  required: ["link", "expiresAt"],
} as const;

import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../../models/User.js"; // تأكد من المسار الصحيح

dotenv.config();

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.sub || decoded.userId || decoded._id).select(
      "_id name role phoneNumber"
    );

    if (!user) {
      return res.status(401).json({ message: "User not found or removed" });
    }

    req.user = {
      userId: user._id,
      name: user.name,
      role: user.role,
      phoneNumber: user.phoneNumber,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied: insufficient permissions" });
    }
    next();
  };
};

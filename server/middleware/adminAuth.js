import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const adminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No admin token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if token has admin flag
        if (!decoded.isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        // Verify user exists and is still an admin
        const user = await User.findById(decoded.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ message: 'Admin access denied' });
        }

        req.adminId = decoded.userId;
        req.adminUser = user;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid admin token' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Admin token expired' });
        }
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};


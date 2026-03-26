// User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },  // ✅ ไม่ required — Google login ไม่มี password
    googleId: { type: String },  // ✅ NEW: Google OAuth ID
    favorites: [
        {
            influencerName: { type: String, required: true },
            platform: { type: String, enum: ['tiktok', 'youtube'], default: 'tiktok' },
            addedAt: { type: Date, default: Date.now }
        }
    ],
    // ✅ NEW: Reset Password
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (password) {
    if (!this.password) return false;  // Google user ไม่มี password
    return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
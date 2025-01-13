// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
_id: {
type: String,
required: true,
},
userId: {
type: String,
required: true,
unique: true // تأكد من أنه فريد
},
email: {
type: String,
required: true,
unique: true
},
password: {
type: String,
required: true
},
name: {
type: String,
required: true
},
      fcmToken: {
        type: String,
        default: null
    },

role: {
type: String,
enum: ['طالب_خدمة', 'مقدم_خدمة'],
required: true
},
createdAt: {
type: Date,
default: Date.now
},
});


module.exports = mongoose.model('User', UserSchema);

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.notifyOnNewTransaction = functions.database
  .ref("/transactions/{transactionId}") // hoặc đổi path theo bạn
  .onCreate(async (snapshot, context) => {
    const transaction = snapshot.val();

    // Lấy thông tin người nhận thông báo (token FCM)
    const fcmToken = transaction.userFcmToken; // bạn cần lưu token khi user login

    const payload = {
      notification: {
        title: "Chuyển khoản thành công",
        body: `Đã nhận ${transaction.amount} từ ${transaction.senderName}`,
        sound: "default",
      },
    };

    // Gửi thông báo
    try {
      await admin.messaging().sendToDevice(fcmToken, payload);
      console.log("Thông báo đã gửi!");
    } catch (error) {
      console.error("Lỗi khi gửi FCM:", error);
    }
});

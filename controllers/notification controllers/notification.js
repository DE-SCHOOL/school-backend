const { messaging, db } = require('./../../firebase.config');

// Function to send FCM notifications
const sendNotification = (token, { message, sender, id, gender }) => {
	const tags1 = '<p style="color: #2d67dd;"><b>';
	const tags2 = '</span></p></b></p>';
	const payload = {
		notification: {
			title: `${tags1}${sender}${tags2}`,
			body: `${message}`,
		},
		data: {
			id,
			gender,
			name: sender,
		},
		token: token, // Recipient device's FCM token
		android: {
			priority: 'high',
		},
		apns: {
			payload: {
				aps: {
					'content-available': 1,
				},
			},
		},
	};

	messaging
		.send(payload)
		.then((response) => {
			console.log('Successfully sent notification:', response);
		})
		.catch((error) => {
			console.log('Error sending notification:', error);
		});
};

const listenToNewMessageAlert = () => {
	// Set up Firestore snapshot listener
	db.collection('messages').onSnapshot((snapshot) => {
		snapshot.docChanges().forEach((change) => {
			const messageData = change.doc.data();

			// Check if a new message has been added and is unread
			if (change.type === 'added' && messageData.readAt === null) {
				const receiverId = messageData.receiverId;
				const senderId = messageData.senderId;

				// Get the receiver's FCM token from the users collection
				// db.collection('users')
				// 	.doc(receiverId)
				// 	.get()
				// 	.then((userDoc) => {
				// 		if (userDoc.exists) {
				// 			const user = userDoc.data();
				// 			const fcmToken = user.fcmToken;

				// 			// Send notification to the receiver
				// 			sendNotification(fcmToken, {
				// 				message: messageData.message,
				// 				// sender: user.name,
				// 			});
				// 		}
				// 	})
				// 	.catch((err) => {
				// 		console.error('Error getting user data:', err);
				// 	});

				Promise.all([
					db.collection('users').doc(receiverId).get(),
					db.collection('users').doc(senderId).get(),
				])
					.then(([receiverDoc, senderDoc]) => {
						if (receiverDoc.exists && senderDoc.exists) {
							const receiver = receiverDoc.data();
							const sender = senderDoc.data();
							const fcmToken = receiver.fcmToken;

							// Send notification to the receiver
							sendNotification(fcmToken, {
								message: messageData.message,
								sender: sender.name, // Include sender's name
								id: senderId,
								gender: sender.gender,
							});
						}
					})
					.catch((err) => {
						console.error('Error getting user data:', err);
					});
			}
		});
	});
};

module.exports = listenToNewMessageAlert;

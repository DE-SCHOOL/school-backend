const jwt = require('jsonwebtoken');

exports.createToken = async (id, secrete) => {
	const token = await jwt.sign({ id }, secrete, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});

	return token;
};

exports.verifyToken = async (token, secrete) => {
	const isToken = await jwt.verify(token, secrete);

	return isToken;
};

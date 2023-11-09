const jwt = require('jsonwebtoken');

exports.createToken = async (id) => {
	const token = await jwt.sign({id}, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});

	return token;
};

exports.verifyToken = async (token) => {
	const isToken = await jwt.verify(token, process.env.JWT_SECRET);

	return isToken;
};

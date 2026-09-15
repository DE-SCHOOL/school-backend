const mongoose = require('mongoose');
const validator = require('validator');

// The top-of-funnel lead capture a public "Request a Demo" page submits
// to — filled in before any School exists, so this is deliberately not
// tenant-scoped (there's no tenant yet). Not linked to a School at
// creation; school.controller.js's createSchool links one in
// afterwards, once a lead actually converts.
const demoRequestSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Contact name is required'],
	},
	schoolName: {
		type: String,
		required: [true, 'School name is required'],
	},
	contactEmail: {
		type: String,
		required: [true, 'Contact email is required'],
		validate: [validator.isEmail, 'Invalid contact email'],
	},
	contactPhone: {
		type: String,
	},
	cityRegion: {
		type: String,
	},
	studentCount: {
		type: Number,
	},
	notes: {
		type: String,
	},
	status: {
		type: String,
		enum: {
			values: [
				'lead',
				'demo_scheduled',
				'contract_sent',
				'active',
				'suspended',
				'churned',
			],
			message:
				'Status must be lead, demo_scheduled, contract_sent, active, suspended, or churned',
		},
		default: 'lead',
	},
	// Set once this lead converts into a real School via
	// school.controller.js's createSchool.
	schoolId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'school',
		default: null,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const DemoRequest = mongoose.model('demo_request', demoRequestSchema);
module.exports = DemoRequest;

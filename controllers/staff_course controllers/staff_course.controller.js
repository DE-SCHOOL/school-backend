const sendResponse = require('../../utilities/sendResponse');
const StaffCourse = require('./../../models/staff_courses.model');
const ErrorApi = require('./../../utilities/ErrorApi');
const catchAsync = require('./../../utilities/catchAsync');

exports.assignStaffCourse = catchAsync(async (req, res, next) => {
	const { courses, staff } = req.body;
	if (!courses || courses?.length === 0)
		return next(
			new ErrorApi('a course or more must be assigned to a lecturer', 400)
		);

	const staffCourse = await StaffCourse.create({ courses, staff });

	sendResponse(res, 'success', 201, staffCourse);
});

exports.getStaffCourse = catchAsync(async (req, res, next) => {
	const assignedCourses = await StaffCourse.find({});

	const trial = { ...assignedCourses };

	let staffCourses = [];

	//Get all staff IDs as an array
	let staffsID = [];
	assignedCourses.map((course) => {
		if (!staffsID.includes(`${course.staff._id}`)) {
			staffsID.push(`${course.staff._id}`);
		}
	});

	//Group the courses per availaible staffs (staffsID)
	let coursesGroup = [];
	staffsID.map((id) => {
		let assigned = assignedCourses.filter(
			(course) => `${course.staff._id}` === id
		);

		//mutate courses, not really clear
		let courses;
		assigned.map((course, index) => {
			if (index > 0) {
				courses.push(...course.courses);
			} else {
				courses = course.courses; //Mutating courses seems to be what is happening here
			}
		});

		//overwrite first object
		let CoursesPerTeacher = assigned[0];
		coursesGroup.push(CoursesPerTeacher);
	});

	sendResponse(res, 'success', 200, coursesGroup);
});

exports.getMyCourses = catchAsync(async (req, res, next) => {
	const staff = req.params.teacherID;
	const teacherCourses = await StaffCourse.find({ staff });

	const courses = [];
	// +semester +credit_value +status
	teacherCourses.map((course) => {
		courses.push(...course.courses);
	});
	sendResponse(res, 'success', 200, courses);
});

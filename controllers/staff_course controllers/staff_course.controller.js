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

exports.editAssignedCourses = catchAsync(async (req, res, next) => {
	const { teacherID } = req.params;
	const { courses } = req.body;
	if (!courses || courses?.length === 0)
		return next(
			new ErrorApi('a course or more must be assigned to a lecturer', 400)
		);

	const staffCourse = await StaffCourse.findOneAndUpdate(
		{ staff: teacherID },
		{ courses },
		{ new: true, runValidators: true }
	);

	sendResponse(res, 'success', 200, staffCourse);
});

// exports.getStaffCourse = catchAsync(async (req, res, next) => {
// 	const assignedCourses = await StaffCourse.find({});

// 	const trial = { ...assignedCourses };

// 	let staffCourses = [];

// 	//Get all staff IDs as an array
// 	let staffsID = [];
// 	assignedCourses.map((course) => {
// 		if (!staffsID.includes(`${course.staff._id}`)) {
// 			staffsID.push(`${course.staff._id}`);
// 		}
// 	});

// 	//Group the courses per availaible staffs (staffsID)
// 	let coursesGroup = [];
// 	staffsID.map((id) => {
// 		let assigned = assignedCourses.filter(
// 			(course) => `${course.staff._id}` === id
// 		);

// 		//mutate courses, not really clear
// 		let courses;
// 		assigned.map((course, index) => {
// 			if (index > 0) {
// 				courses.push(...course.courses);
// 			} else {
// 				courses = course.courses; //Mutating courses seems to be what is happening here
// 			}
// 		});

// 		//overwrite first object
// 		let CoursesPerTeacher = assigned[0];
// 		coursesGroup.push(CoursesPerTeacher);
// 	});

// 	sendResponse(res, 'success', 200, coursesGroup);
// });

exports.getStaffCourse = catchAsync(async (req, res, next) => {
	const assignedCourses = await StaffCourse.find({});

	//Get all staff IDs as an array
	let staffsID = [];
	assignedCourses.map((course) => {
		if (!staffsID.includes(`${course.staff._id}`)) {
			staffsID.push(`${course.staff._id}`);
		}
	});

	// console.log(staffsID);

	//Group the courses per availaible staffs (staffsID)
	let coursesGroup = [];
	staffsID.map((id) => {
		let assigned = assignedCourses.filter(
			(course) => `${course.staff._id}` === id
		);

		//console.log(assigned, 'assigned'); //All courses assigned to a particular teacher, in different occurences

		let teacherCourses = []; //All courses assigned to a particular teacher in the same occurance
		assigned.map((course) => {
			teacherCourses.push(...course.courses);
		});

		// console.log(teacherCourses, 'teacherCourses');

		//Avoid duplicate course information
		let myCourses = []; //array of distinct course information
		let teacherCourseIDs = []; //array of course ids to keep track of distinctiveness

		teacherCourses.map((course, index) => {
			if (index === 0) {
				myCourses.push(course);
			} else {
				if (teacherCourseIDs.includes(`${course._id}`)) {
					return;
				} else {
					myCourses.push(course);
				}
			}

			teacherCourseIDs.push(`${course._id}`);
		});

		// console.log(myCourses, 'myCourses');

		const data = {
			courses: myCourses,
			staff: assigned[0].staff,
			_id: assigned[0]._id,
			createdAt: assigned[0].createdAt,
			_v: assigned[0]._v,
		};

		coursesGroup.push(data);
	});

	sendResponse(res, 'success', 200, coursesGroup);
});

exports.getMyCourses = catchAsync(async (req, res, next) => {
	const staff = req.params.teacherID;
	// console.log(staff);
	const teacherCoursesInfo = await StaffCourse.find({ staff });

	const courses = [];
	teacherCoursesInfo.map((course) => {
		courses.push(course);
	});

	let teacherCourses = [];
	courses.map((course) => {
		teacherCourses.push(...course.courses);
	});

	//Avoid duplicate course information
	let myCourses = []; //array of distinct course information
	let teacherCourseIDs = []; //array of course ids to keep track of distinctiveness

	teacherCourses.map((course, index) => {
		if (index === 0) {
			myCourses.push(course);
		} else {
			if (teacherCourseIDs.includes(`${course._id}`)) {
				return;
			} else {
				myCourses.push(course);
			}
		}

		teacherCourseIDs.push(`${course._id}`);
	});
	const data = {
		courses: myCourses,
		staff: courses[0]?.staff,
	};

	// console.log(data);
	sendResponse(res, 'success', 200, data);
});

exports.calcStatsPerCourse = async (
	courseID,
	semester,
	academicYear,
	Course,
	Mark
) => {
	const courseInfo = await Course.findById(courseID);

	const courseMarkInfo = await Mark.find({ course: courseID, academicYear });

	//total students sat for exam and/or ca and have scores not equal to zero (0)
	const studentsSat = courseMarkInfo.filter(
		(mark) => mark[`${semester}Total`] !== 0
	);

	const totalSat = studentsSat.length;

	//total passed
	const totalPassed = courseMarkInfo.filter(
		(mark) => mark[`${semester}Total`] >= 50
	).length;

	//Number of As
	const totalAs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'A'
	).length;

	//Number of B+s
	const totalBplus = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'B+'
	).length;

	//Number of Bs
	const totalBs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'B'
	).length;

	//number of Cs
	const totalCs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'C'
	).length;

	//Number of C+s
	const totalCplus = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'C+'
	).length;

	//Number of Ds
	const totalDs = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'D'
	).length;

	//Number of D+s
	const totalDplus = courseMarkInfo.filter(
		(mark) => mark[`${semester}Grade`] === 'D+'
	).length;

	//Number of Fs who actually sat and wrote the exam and/or ca
	const totalFs = studentsSat.filter(
		(mark) => mark[`${semester}Grade`] === 'F'
	).length;

	//boys who sat and wrote the exam and/or ca
	const boyStudents = studentsSat.filter(
		(stud) => stud.student?.gender === 'male'
	);

	//total number of boys who passed
	const totalBoysPassed = boyStudents.filter(
		(mark) => mark[`${semester}Total`] >= 50
	).length;

	//girls who sat and wrote the exam and/or ca
	const girlStudents = studentsSat.filter(
		(stud) => stud.student?.gender === 'female'
	);

	//total number of girls who passed
	const totalGirlsPassed = girlStudents.filter(
		(mark) => mark[`${semester}Total`] >= 50
	).length;

	//number of students with marks Less than 40 who wrote exam and/or ca
	const numMarksLess40 = studentsSat.filter(
		(mark) => mark[`${semester}Total`] <= 40
	).length;

	//number of students with marks Less than or equal 45 and greater than 41 who wrote exam and/or ca
	const numMarksBtw41and45 = studentsSat.filter(
		(mark) => mark[`${semester}Total`] <= 45 && mark[`${semester}Total`] >= 41
	).length;

	//number of students with marks Less than 49 and greater than or equal 46 who wrote exam and/or ca
	const numMarksBtw46and49 = studentsSat.filter(
		(mark) => mark[`${semester}Total`] <= 49 && mark[`${semester}Total`] >= 46
	).length;

	const percentPassed = (superSet, subSet) => {
		if (superSet === 0) return 0.0;

		return ((subSet / superSet) * 100).toFixed(1) || 0;
	};

	const percentFailed = (superSet, subSet) => {
		if (subSet === 0) return 0.0;

		return ((subSet / superSet) * 100).toFixed(1) || 0;
	};
	const courseStats = {
		totalOffering: courseMarkInfo.length,
		totalSat,
		percentPassed: 1 * ((totalPassed / totalSat) * 100).toFixed(1) || 0,
		percentFailed: 1 * (100 - (totalPassed / totalSat) * 100).toFixed(1) || 0,
		totalAs,
		totalBplus,
		totalBs,
		totalCplus,
		totalCs,
		totalDplus,
		totalDs,
		totalFs,
		percentPassedBoys: percentPassed(boyStudents.length, totalBoysPassed),
		percentPassedGirls: percentPassed(girlStudents.length, totalGirlsPassed),
		numMarksLess40,
		numMarksBtw41and45,
		numMarksBtw46and49,
		courseInfo,
	};

	return courseStats;
};

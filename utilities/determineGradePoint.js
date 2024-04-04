const determineGradePoint = (mark) => {
	if (mark >= 80) {
		return 4;
	} else if (mark >= 70 && mark < 80) {
		return 3.5;
	} else if (mark >= 60 && mark < 70) {
		return 3;
	} else if (mark >= 55 && mark < 60) {
		return 2.5;
	} else if (mark >= 50 && mark < 55) {
		return 2;
	} else if (mark >= 40 && mark < 50) {
		return 1;
	} else if (mark < 40) {
		return 0;
	}
};

module.exports = determineGradePoint;

const determineGrade = (mark) => {
	if (mark >= 80) {
		return 'A';
	} else if (mark >= 70 && mark < 80) {
		return 'B+';
	} else if (mark >= 60 && mark < 70) {
		return 'B';
	} else if (mark >= 55 && mark < 60) {
		return 'C+';
	} else if (mark >= 50 && mark < 55) {
		return 'C';
	} else if (mark >= 45 && mark < 50) {
		return 'D+';
	} else if (mark >= 40 && mark < 45) {
		return 'D';
	} else if (mark < 40) {
		return 'F';
	}
};

module.exports = determineGrade;

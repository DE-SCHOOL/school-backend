exports.insertBulkDoc = (Model, data) => {
	let insertDocs = [];
	if (data.length > 0) {
		insertDocs = data.map(async (item) => {
			const createdItem = await Model.create(item);
			return createdItem;
		});
	}

	return insertDocs;
};

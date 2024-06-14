const reorderTableRows = (tableRows, isFieldOrderAlphabetic) => {
	if (!isFieldOrderAlphabetic) {
		return tableRows;
	}

	if (!Array.isArray(tableRows) || !tableRows.length) {
		return tableRows;
	}

	const reorderedFieldNames = Object.keys(tableRows[0]).sort();
	return tableRows.map(row =>
		Object.values(row).reduce(
			(columns, columnValue, i) => ({
				...columns,
				[reorderedFieldNames[i]]: row[reorderedFieldNames[i]],
			}),
			{},
		),
	);
};

module.exports = reorderTableRows;

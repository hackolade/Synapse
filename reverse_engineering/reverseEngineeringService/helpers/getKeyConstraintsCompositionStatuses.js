const getKeyConstraintsCompositionStatuses = keyConstraintsInfo => {
	const keyConstraintsColumns = keyConstraintsInfo.reduce((constraintsColumns, keyConstraintInfo) => {
		const { constraintName, columnName } = keyConstraintInfo;
		const currentConstraintColumns = constraintsColumns[constraintName];
		if (!constraintsColumns.hasOwnProperty(constraintName)) {
			return {
				...constraintsColumns,
				[constraintName]: [columnName],
			};
		}

		return {
			...constraintsColumns,
			[constraintName]: [...currentConstraintColumns, columnName],
		};
	}, {});

	return Object.entries(keyConstraintsColumns).reduce(
		(statuses, [name, columns]) => ({
			...statuses,
			[name]: Array.from(new Set(columns)).length > 1 ? true : false,
		}),
		{},
	);
};

module.exports = getKeyConstraintsCompositionStatuses;

const reverseTableColumn = require('./reverseTableColumn');

const getUserDefinedTypes = (tableInfo, databaseUDT) =>
	tableInfo.reduce((columnSchemas, column) => {
		const columnName = column['DOMAIN_NAME'];
		const info = databaseUDT.find(udt => udt.name === columnName);
		if (!columnName) {
			return columnSchemas;
		}

		return {
			...columnSchemas,
			[columnName]: {
				...reverseTableColumn(column),
				required: !info.is_nullable,
			},
		};
	}, {});

module.exports = getUserDefinedTypes;

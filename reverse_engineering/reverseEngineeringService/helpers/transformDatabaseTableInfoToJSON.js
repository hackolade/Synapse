const reverseTableColumn = require('./reverseTableColumn');

const getReversedColumn = column =>
	column['DOMAIN_NAME']
		? { $ref: `#model/definitions/${column['DOMAIN_NAME']}`, required: column['IS_NULLABLE'] === 'NO' }
		: reverseTableColumn(column);

const transformDatabaseTableInfoToJSON = tableInfo => jsonSchema =>
	tableInfo.reduce(
		(columnSchemas, column) => ({
			...columnSchemas,
			properties: {
				...columnSchemas.properties,
				[column['COLUMN_NAME']]: getReversedColumn(column),
			},
		}),
		jsonSchema,
	);

module.exports = transformDatabaseTableInfoToJSON;

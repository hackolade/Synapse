const getObjectsFromDatabase = async client => {
	const tablesInfo = await client.query`select * from INFORMATION_SCHEMA.tables`;
	const schemaObjects = tablesInfo.filter(item => item.TABLE_TYPE !== 'VIEW').reduce((schemas, { TABLE_NAME, TABLE_TYPE, TABLE_SCHEMA }) => {
		const schema = schemas[TABLE_SCHEMA] || { dbName: TABLE_SCHEMA, dbCollections: [], views: [] };
		if (TABLE_TYPE === 'VIEW') {
			return {
				...schemas,
				[TABLE_SCHEMA]: {
					...schema,
					views: [...schema.views, TABLE_NAME],
				}
			};
		}

		return {
			...schemas,
			[TABLE_SCHEMA]: {
				...schema,
				dbCollections: [...schema.dbCollections, TABLE_NAME],
			}
		};
	}, {});
	return Object.values(schemaObjects);
};

module.exports = getObjectsFromDatabase;

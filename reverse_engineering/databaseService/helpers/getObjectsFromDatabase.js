const getObjectsFromDatabase = async client => {
	const { recordset } = await client.query`select * from INFORMATION_SCHEMA.tables`;
	const schemaObjects = recordset.reduce((schemas, { TABLE_NAME, TABLE_TYPE, TABLE_SCHEMA }) => {
		const schema = schemas[TABLE_SCHEMA] || { dbName: TABLE_SCHEMA, dbCollections: [], views: [] };
		if (TABLE_TYPE === 'VIEW') {
			return {
				...schemas,
				[TABLE_SCHEMA]: {
					...schema,
					views: [...schema.views, TABLE_NAME],
				},
			};
		}

		return {
			...schemas,
			[TABLE_SCHEMA]: {
				...schema,
				dbCollections: [...schema.dbCollections, TABLE_NAME],
			},
		};
	}, {});

	return Object.values(schemaObjects).map(item => {
		if (item.dbCollections.length !== 0) {
			return item;
		}

		if (item.views.length === 0) {
			return item;
		}

		return {
			...item,
			dbCollections: item.views.map(viewName => `${viewName} (v)`),
			views: [],
		};
	});
};

module.exports = getObjectsFromDatabase;

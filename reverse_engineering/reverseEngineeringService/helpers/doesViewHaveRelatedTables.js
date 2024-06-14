const doesViewHaveRelatedTables = (view, tables) => {
	return view.relatedTables.every(({ tableName, schemaName }) =>
		tables.find(({ collectionName, dbName }) => tableName === collectionName && schemaName === dbName),
	);
};

module.exports = doesViewHaveRelatedTables;

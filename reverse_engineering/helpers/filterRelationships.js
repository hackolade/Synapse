const doesCollectionsExist = collections => relationship => {
	const parentCollection = collections.find(({ dbName, collectionName }) =>
		relationship.dbName === dbName && collectionName === relationship.parentCollection );

	const childCollection = collections.find(({ dbName, collectionName }) =>
		relationship.childDbName === dbName && collectionName === relationship.childCollection );
	return Boolean(parentCollection && childCollection);
};

const filterRelationships = (relationships, collections) =>
	relationships.filter(doesCollectionsExist(collections));

module.exports = filterRelationships;
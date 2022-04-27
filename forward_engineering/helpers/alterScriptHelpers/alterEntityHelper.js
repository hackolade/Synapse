module.exports = (app, options) => {
	const _ = app.require('lodash');
	const { getEntityName } = app.require('@hackolade/ddl-fe-utils').general;
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const { getTableName } = require('../general')(app);
	const ddlProvider = require('../../ddlProvider')(options, app);
	const { generateIdToNameHashTable, generateIdToActivatedHashTable } = app.require('@hackolade/ddl-fe-utils');
	const { checkFieldPropertiesChanged, modifyGroupItems, setIndexKeys } = require('./common')(app);

	const getAddCollectionScript = collection => {
		const schemaName = collection.compMod.keyspaceName;
		const schemaData = { schemaName };
		const jsonSchema = { ...collection, ...(collection?.role || {}) };
		const tableName = getEntityName(jsonSchema);
		const idToNameHashTable = generateIdToNameHashTable(jsonSchema);
		const idToActivatedHashTable = generateIdToActivatedHashTable(jsonSchema);
		const columnDefinitions = _.toPairs(jsonSchema.properties).map(([name, column]) =>
			createColumnDefinitionBySchema({
				name,
				jsonSchema: column,
				parentJsonSchema: jsonSchema,
				ddlProvider,
				schemaData,
			}),
		);
		const checkConstraints = (jsonSchema.chkConstr || []).map(check =>
			ddlProvider.createCheckConstraint(ddlProvider.hydrateCheckConstraint(check)),
		);
		const tableData = {
			name: tableName,
			columns: columnDefinitions.map(ddlProvider.convertColumnDefinition),
			checkConstraints: checkConstraints,
			foreignKeyConstraints: [],
			schemaData,
			columnDefinitions,
		};

		const indexesScripts = (jsonSchema.Indxs || [])
			.map(hydrateIndex({ idToNameHashTable, idToActivatedHashTable, ddlProvider, tableData, schemaData }))
			.map(index => _.trim(ddlProvider.createIndex(tableName, index, null, jsonSchema.isActivated)));

		const hydratedTable = ddlProvider.hydrateTable({
			tableData,
			entityData: [jsonSchema],
			jsonSchema,
			idToNameHashTable,
		});
		const tableScript = ddlProvider.createTable(hydratedTable, jsonSchema.isActivated);

		return [tableScript, ...indexesScripts].join('\n\n');
	};

	const getDeleteCollectionScript = collection => {
		const jsonSchema = { ...collection, ...(collection?.role || {}) };
		const tableName = getEntityName(jsonSchema);
		const schemaName = collection.compMod.keyspaceName;
		const fullName = getTableName(tableName, schemaName);

		return ddlProvider.dropTable(fullName);
	};

	const getModifyCollectionScript = collection => {
		const jsonSchema = { ...collection, ...(collection?.role || {}) };
		const schemaName = collection.compMod.keyspaceName;
		const schemaData = { schemaName };
		const idToNameHashTable = generateIdToNameHashTable(jsonSchema);
		const idToActivatedHashTable = generateIdToActivatedHashTable(jsonSchema);

		const indexesScripts = modifyGroupItems({
			data: jsonSchema,
			key: 'Indxs',
			hydrate: hydrateIndex({
				idToNameHashTable,
				idToActivatedHashTable,
				ddlProvider,
				schemaData,
				tableData: [jsonSchema],
			}),
			create: (tableName, index) =>
				index.orReplace
					? `${ddlProvider.dropIndex(tableName, index)}\n\n${ddlProvider.createIndex(tableName, index, null)}`
					: ddlProvider.createIndex(tableName, index, schemaData),
			drop: (tableName, index) => ddlProvider.dropIndex(tableName, index),
		});

		return []
			.concat(indexesScripts)
			.filter(Boolean)
			.join('\n\n');
	};

	const getAddColumnScript = collection => {
		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
		const schemaName = collectionSchema.compMod?.keyspaceName;
		const fullName = getTableName(tableName, schemaName);
		const schemaData = { schemaName };

		return _.toPairs(collection.properties)
			.filter(([__, jsonSchema]) => !jsonSchema.compMod)
			.map(([name, jsonSchema]) =>
				createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: collectionSchema,
					ddlProvider,
					schemaData,
				}),
			)
			.map(ddlProvider.convertColumnDefinition)
			.map(script => ddlProvider.addColumn(fullName, script));
	};

	const getDeleteColumnScript = collection => {
		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
		const schemaName = collectionSchema.compMod?.keyspaceName;
		const fullName = getTableName(tableName, schemaName);

		return _.toPairs(collection.properties)
			.filter(([__, jsonSchema]) => !jsonSchema.compMod)
			.map(([name]) => ddlProvider.dropColumn(fullName, name));
	};

	const getModifyColumnScript = collection => {
		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
		const schemaName = collectionSchema.compMod?.keyspaceName;
		const fullName = getTableName(tableName, schemaName);
		const schemaData = { schemaName };

		const renameColumnScripts = _.values(collection.properties)
			.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
			.map(jsonSchema =>
				ddlProvider.renameColumn(fullName, jsonSchema.compMod.oldField.name, jsonSchema.compMod.newField.name),
			);

		const changeTypeScripts = _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']))
			.map(([name, jsonSchema]) => {
				const columnDefinition = createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: collectionSchema,
					ddlProvider,
					schemaData,
				});

				return ddlProvider.alterColumn(fullName, columnDefinition);
			});

		return [...renameColumnScripts, ...changeTypeScripts];
	};

	const hydrateIndex =
		({ idToNameHashTable, idToActivatedHashTable, ddlProvider, tableData, schemaData }) =>
		index => {
			index = setIndexKeys(idToNameHashTable, idToActivatedHashTable, index);

			return ddlProvider.hydrateIndex(index, tableData, schemaData);
		};

	return {
		getAddCollectionScript,
		getDeleteCollectionScript,
		getModifyCollectionScript,
		getAddColumnScript,
		getDeleteColumnScript,
		getModifyColumnScript,
	};
};

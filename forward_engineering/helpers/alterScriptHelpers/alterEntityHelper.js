const _ = require('lodash');
const { getTableName } = require('../general');
const { getEntityName } = require('../../utils/general');
const { createColumnDefinitionBySchema } = require('./createColumnDefinition');
const { checkFieldPropertiesChanged, modifyGroupItems, setIndexKeys } = require('./common');
const { getModifyPkScripts } = require('./entityHelper/primaryKeyHelper');
const { getModifyUkScripts } = require('./entityHelper/uniqueKeyHelper');

const alterEntityHelper = (app, options) => {
	const ddlProvider = require('../../ddlProvider')(null, options, app);
	const { generateIdToNameHashTable, generateIdToActivatedHashTable } = app.require('@hackolade/ddl-fe-utils');

	const getAddCollectionScript = collection => {
		const schemaName = collection.compMod.keyspaceName;
		const schemaData = { schemaName };
		const jsonSchema = { ...collection, ...collection?.role };
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

		const tableData = {
			name: tableName,
			columns: columnDefinitions.map(ddlProvider.convertColumnDefinition),
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
		const jsonSchema = { ...collection, ...collection?.role };
		const tableName = getEntityName(jsonSchema);
		const schemaName = collection.compMod.keyspaceName;
		const fullName = getTableName(tableName, schemaName);

		return ddlProvider.dropTable(fullName);
	};

	const getModifyCollectionScript = collection => {
		const jsonSchema = { ...collection, ...collection?.role };
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

		return [indexesScripts].flat().filter(Boolean).join('\n\n');
	};

	const getAddColumnScript = collection => {
		const collectionSchema = { ...collection, ..._.omit(collection?.role, 'properties') };
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
		const collectionSchema = { ...collection, ..._.omit(collection?.role, 'properties') };
		const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
		const schemaName = collectionSchema.compMod?.keyspaceName;
		const fullName = getTableName(tableName, schemaName);

		return _.toPairs(collection.properties)
			.filter(([__, jsonSchema]) => !jsonSchema.compMod)
			.map(([name]) => ddlProvider.dropColumn(fullName, name));
	};

	const getModifyColumnScript = collection => {
		const collectionSchema = { ...collection, ..._.omit(collection?.role, 'properties') };
		const tableName = collectionSchema?.code || collectionSchema?.collectionName || collectionSchema?.name;
		const schemaName = collectionSchema.compMod?.keyspaceName;
		const fullTableName = getTableName(tableName, schemaName);
		const schemaData = { schemaName };

		const renameColumnScripts = _.values(collection.properties)
			.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
			.map(jsonSchema =>
				ddlProvider.renameColumn(
					fullTableName,
					jsonSchema.compMod.oldField.name,
					jsonSchema.compMod.newField.name,
				),
			);

		const pairs = _.toPairs(collection.properties);

		const alterColumnScripts = pairs.reduce((acc, [name, jsonSchema]) => {
			const fieldTypeChanged = checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']);

			const columnDefinition = createColumnDefinitionBySchema({
				name,
				jsonSchema,
				parentJsonSchema: collectionSchema,
				ddlProvider,
				schemaData,
			});

			if (fieldTypeChanged) {
				acc.push(
					ddlProvider.alterColumn({
						fullTableName,
						columnDefinition,
						alterType: fieldTypeChanged,
					}),
				);
			}

			return acc;
		}, []);

		const alterDefaultScripts = pairs
			.filter(
				([, jsonSchema]) =>
					options?.scriptGenerationOptions?.feActiveOptions?.columnDefaultValues === 'separate' &&
					jsonSchema.defaultConstraintName,
			)
			.map(([name, jsonSchema]) => {
				return ddlProvider.alterColumnDefault({
					fullTableName,
					columnName: name,
					constraint: { name: jsonSchema.defaultConstraintName, value: jsonSchema.default },
				});
			});

		return [...renameColumnScripts, ...alterColumnScripts, ...alterDefaultScripts];
	};

	const getModifyCollectionKeysScript = collection => {
		const modifyPkScripts = getModifyPkScripts(collection, options);
		const modifyUkScripts = getModifyUkScripts(collection, options);

		return [...modifyPkScripts, ...modifyUkScripts].filter(Boolean);
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
		getModifyCollectionKeysScript,
	};
};

module.exports = alterEntityHelper;

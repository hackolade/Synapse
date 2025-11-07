const _ = require('lodash');
const { getTableName } = require('../../general');
const { getEntityName } = require('../../../utils/general');
const { assignTemplates } = require('../../../utils/assignTemplates');
const templates = require('../../../configs/templates');
const { getTerminator } = require('../../optionsHelper');
const { commentIfDeactivated } = require('../../commentIfDeactivated');

/**
 * Convert keys to string with proper handling of activated/deactivated columns
 * @param {Array<{name: string, isActivated: boolean}>} keys
 * @param {boolean} isParentActivated - whether the parent table is activated
 * @return {string}
 */
const keysToString = (keys, isParentActivated) => {
	if (!Array.isArray(keys) || keys.length === 0) {
		return '';
	}

	const splitter = ', ';
	let deactivatedKeys = [];
	const processedKeys = keys
		.reduce((keysArray, key) => {
			const keyName = `[${key.name}]`;

			if (!_.get(key, 'isActivated', true)) {
				deactivatedKeys.push(keyName);
				return keysArray;
			}

			return [...keysArray, keyName];
		}, [])
		.filter(Boolean);

	// If parent is not activated or no activated keys,
	// return all keys without commenting, to avoid nested comments
	if (!isParentActivated || processedKeys.length === 0) {
		return keys.map(key => `[${key.name}]`).join(splitter);
	}

	// If no deactivated keys, return activated keys only
	if (deactivatedKeys.length === 0) {
		return processedKeys.join(splitter);
	}

	// Mix of activated and deactivated keys
	return (
		processedKeys.join(splitter) +
		commentIfDeactivated(splitter + deactivatedKeys.join(splitter), { isActivated: false }, true)
	);
};

/**
 * Get only activated keys as string (for when we don't support partial deactivation)
 * @param {Array<{name: string, isActivated: boolean}>} keys
 * @return {string}
 */
const activeKeysToString = keys => {
	return keys?.map(key => `[${key.name}]`).join(', ');
};

/**
 * Configuration object for key constraint handling
 * @typedef {Object} KeyConstraintConfig
 * @property {string} constraintType - e.g., 'PRIMARY KEY' or 'UNIQUE'
 * @property {string} compModKeyName - e.g., 'primaryKey' or 'uniqueKey'
 * @property {string} columnKeyProperty - e.g., 'primaryKey' or 'unique'
 * @property {string} compositeKeyProperty - e.g., 'compositePrimaryKey' or 'compositeUniqueKey'
 */

/**
 * Get column names from composite key by matching keyId with column GUID
 * @param {Array<{ type: string, keyId: string}>} compositeKey
 * @param {Object.<string, any>} properties
 * @param {KeyConstraintConfig} config
 */
const getCompositeKeyColumnNames = (compositeKey, properties, config) => {
	return compositeKey
		.map(keyDto => {
			const column = Object.entries(properties).find(([name, col]) => col.GUID === keyDto.keyId);
			return column ? { name: column[0], isActivated: column[1].isActivated } : null;
		})
		.filter(Boolean);
};

/**
 * Compare constraint details
 * @param {Object} oldConstraint
 * @param {Object} newConstraint
 * @return {boolean}
 */
const areConstraintsEqual = (oldConstraint, newConstraint) => {
	return _.isEqual(oldConstraint, newConstraint);
};

/**
 * Check if composite keys have changed and return key data if so
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @return {{hasChanges: boolean, newKeys: Array, oldKeys: Array, tableInfo: Object} | null}
 */
const getCompositeKeyChangeData = (collection, config) => {
	const keyDto = collection?.role?.compMod?.[config.compModKeyName] || {};
	const newKeys = keyDto.new || [];
	const oldKeys = keyDto.old || [];

	if (newKeys.length === 0 && oldKeys.length === 0) {
		return null;
	}

	if (newKeys.length === oldKeys.length) {
		const areKeyArraysEqual = _(oldKeys).differenceWith(newKeys, _.isEqual).isEmpty();
		if (areKeyArraysEqual) {
			return null;
		}
	}

	const collectionSchema = { ...collection, ..._.omit(collection?.role, 'properties') };
	const tableName = getEntityName(collectionSchema);
	const schemaName = collection.compMod?.keyspaceName;
	const fullName = getTableName(tableName, schemaName);
	const isTableActivated = _.get(collectionSchema, 'isActivated', true);

	return {
		hasChanges: true,
		newKeys,
		oldKeys,
		tableInfo: {
			fullName,
			isTableActivated,
		},
	};
};

/**
 * Get ADD CONSTRAINT scripts for composite keys
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @param {Object} options
 * @return {string[]}
 */
const getAddCompositeKeyScripts = (collection, config, options) => {
	const changeData = getCompositeKeyChangeData(collection, config);
	if (!changeData) {
		return [];
	}

	const terminator = getTerminator(options);
	const { newKeys, tableInfo } = changeData;
	const { fullName, isTableActivated } = tableInfo;

	return newKeys
		.map(newKey => {
			const columns = getCompositeKeyColumnNames(
				newKey[config.compositeKeyProperty] || [],
				collection.role.properties,
				config,
			);

			if (_.isEmpty(columns)) {
				return null;
			}

			// For PK: use activeKeysToString (PK columns can't be deactivated)
			// For UK: use keysToString to handle deactivated columns
			const isPrimaryKey = config.constraintType === 'PRIMARY KEY';
			const columnsStr = isPrimaryKey ? activeKeysToString(columns) : keysToString(columns, isTableActivated);

			const constraintName = newKey.constraintName ? `[${newKey.constraintName}]` : '';

			const statement = constraintName
				? `CONSTRAINT ${constraintName} ${config.constraintType} NONCLUSTERED (${columnsStr}) NOT ENFORCED`
				: `${config.constraintType} NONCLUSTERED (${columnsStr}) NOT ENFORCED`;

			const script = assignTemplates(templates.alterTableAddConstraint, {
				tableName: fullName,
				constraint: statement,
				terminator,
			});

			// Determine if the constraint should be activated
			// For PK: all columns are always activated, so check table activation only
			// For UK: check if at least one column is activated AND table is activated
			const atLeastOneColumnActivated = isPrimaryKey || columns.some(col => _.get(col, 'isActivated', true));
			const isConstraintActivated = isTableActivated && atLeastOneColumnActivated;

			return commentIfDeactivated(script, { isActivated: isConstraintActivated });
		})
		.filter(Boolean);
};

/**
 * Get DROP CONSTRAINT scripts for composite keys
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @param {Object} options
 * @return {string[]}
 */
const getDropCompositeKeyScripts = (collection, config, options) => {
	const changeData = getCompositeKeyChangeData(collection, config);
	if (!changeData) {
		return [];
	}

	const terminator = getTerminator(options);
	const { oldKeys, tableInfo } = changeData;
	const { fullName, isTableActivated } = tableInfo;

	return oldKeys
		.map(oldKey => {
			const constraintName = oldKey.constraintName;
			if (!constraintName) {
				return null;
			}

			const script = assignTemplates(templates.alterTable, {
				tableName: fullName,
				command: `DROP CONSTRAINT [${constraintName}]`,
				terminator,
			});

			return commentIfDeactivated(script, { isActivated: isTableActivated });
		})
		.filter(Boolean);
};

/**
 * Get modify scripts for composite keys (drop + add)
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @param {Object} options
 * @return {string[]}
 */
const getModifyCompositeKeyScripts = (collection, config, options) => {
	const dropCompositeKeyScripts = getDropCompositeKeyScripts(collection, config, options);
	const addCompositeKeyScripts = getAddCompositeKeyScripts(collection, config, options);
	return [...dropCompositeKeyScripts, ...addCompositeKeyScripts].filter(Boolean);
};

/**
 * Check if field was changed to be a regular key
 * @param {Object} columnJsonSchema
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @return {boolean}
 */
const wasFieldChangedToBeARegularKey = (columnJsonSchema, collection, config) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const isRegularKey = columnJsonSchema[config.columnKeyProperty] && !columnJsonSchema[config.compositeKeyProperty];
	const wasTheFieldAnyKey = Boolean(oldColumnJsonSchema?.[config.columnKeyProperty]);

	return isRegularKey && !wasTheFieldAnyKey;
};

/**
 * Check if field is no longer a regular key
 * @param {Object} columnJsonSchema
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @return {boolean}
 */
const isFieldNoLongerARegularKey = (columnJsonSchema, collection, config) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldJsonSchema = collection.role.properties[oldName];
	const wasTheFieldARegularKey =
		oldJsonSchema?.[config.columnKeyProperty] && !oldJsonSchema?.[config.compositeKeyProperty];

	const isNotAnyKey = !columnJsonSchema[config.columnKeyProperty] && !columnJsonSchema[config.compositeKeyProperty];
	return wasTheFieldARegularKey && isNotAnyKey;
};

/**
 * Get ADD CONSTRAINT scripts for regular (column-level) keys
 * Note: Synapse doesn't support named constraints for column-level keys
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @param {Object} options
 * @return {string[]}
 */
const getAddRegularKeyScripts = (collection, config, options) => {
	const terminator = getTerminator(options);
	const collectionSchema = { ...collection, ..._.omit(collection?.role, 'properties') };
	const tableName = getEntityName(collectionSchema);
	const schemaName = collectionSchema.compMod?.keyspaceName;
	const fullName = getTableName(tableName, schemaName);

	const isTableActivated = _.get(collectionSchema, 'isActivated', true);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			return wasFieldChangedToBeARegularKey(jsonSchema, collection, config);
		})
		.map(([name, jsonSchema]) => {
			// Synapse doesn't support constraint names for column-level keys
			const statement = `${config.constraintType} NONCLUSTERED ([${name}]) NOT ENFORCED`;

			const script = assignTemplates(templates.alterTableAddConstraint, {
				tableName: fullName,
				constraint: statement,
				terminator,
			});

			// For PK: column is always activated (PK columns can't be deactivated)
			// For UK: check column activation
			const isPrimaryKey = config.constraintType === 'PRIMARY KEY';
			const isColumnActivated = isPrimaryKey || _.get(jsonSchema, 'isActivated', true);
			const isConstraintActivated = isTableActivated && isColumnActivated;

			return commentIfDeactivated(script, { isActivated: isConstraintActivated });
		})
		.filter(Boolean);
};

/**
 * Get DROP CONSTRAINT scripts for regular (column-level) keys
 * Note: Synapse doesn't support named constraints for column-level keys,
 * so we cannot generate DROP scripts for them. They would need to be
 * handled by recreating the column or converting to composite constraints.
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @param {Object} options
 * @return {string[]}
 */
const getDropRegularKeyScripts = (collection, config, options) => {
	// Synapse doesn't support dropping unnamed column-level constraints
	// Return empty array - these constraints can only be removed by:
	// 1. Dropping and recreating the column
	// 2. Converting to composite constraint (which can be named and dropped)
	return [];
};

/**
 * Get modify scripts for regular keys (drop + add)
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @param {Object} options
 * @return {string[]}
 */
const getModifyRegularKeyScripts = (collection, config, options) => {
	const dropKeyScripts = getDropRegularKeyScripts(collection, config, options);
	const addKeyScripts = getAddRegularKeyScripts(collection, config, options);
	return [...dropKeyScripts, ...addKeyScripts].filter(Boolean);
};

/**
 * Get all modify key scripts (both composite and regular)
 *
 * @param {Object} collection
 * @param {KeyConstraintConfig} config
 * @param {Object} options
 * @return {string[]}
 */
const getModifyKeyScripts = (collection, config, options) => {
	const modifyCompositeKeyScripts = getModifyCompositeKeyScripts(collection, config, options);
	const modifyRegularKeyScripts = getModifyRegularKeyScripts(collection, config, options);

	return [...modifyCompositeKeyScripts, ...modifyRegularKeyScripts].filter(Boolean);
};

module.exports = {
	getModifyKeyScripts,
};

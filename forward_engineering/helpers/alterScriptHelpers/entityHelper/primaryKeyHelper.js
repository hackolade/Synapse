const { getModifyKeyScripts } = require('./sharedKeyConstraintHelper');

/**
 * Primary Key constraint configuration
 */
const PRIMARY_KEY_CONFIG = {
	constraintType: 'PRIMARY KEY',
	compModKeyName: 'primaryKey',
	columnKeyProperty: 'primaryKey',
	compositeKeyProperty: 'compositePrimaryKey',
	constraintNameProperty: 'primaryKeyConstraintName',
	optionsProperty: 'primaryKeyOptions',
};

/**
 * Get all modify PK scripts (both composite and regular)
 *
 * @param {Object} collection
 * @param {Object} options
 * @return {string[]}
 */
const getModifyPkScripts = (collection, options) => {
	return getModifyKeyScripts(collection, PRIMARY_KEY_CONFIG, options);
};

module.exports = {
	getModifyPkScripts,
};

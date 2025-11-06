const { getModifyKeyScripts } = require('./sharedKeyConstraintHelper');

/**
 * Unique Key constraint configuration
 */
const UNIQUE_KEY_CONFIG = {
	constraintType: 'UNIQUE',
	compModKeyName: 'uniqueKey',
	columnKeyProperty: 'unique',
	compositeKeyProperty: 'compositeUniqueKey',
	constraintNameProperty: 'uniqueKeyConstraintName',
	optionsProperty: 'uniqueKeyOptions',
};

/**
 * Get all modify UK scripts (both composite and regular)
 *
 * @param {Object} collection
 * @param {Object} options
 * @return {string[]}
 */
const getModifyUkScripts = (collection, options) => {
	return getModifyKeyScripts(collection, UNIQUE_KEY_CONFIG, options);
};

module.exports = {
	getModifyUkScripts,
};

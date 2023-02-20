const transformDatabaseTableInfoToJSON = require('./transformDatabaseTableInfoToJSON');
const reverseTableForeignKeys = require('./reverseTableForeignKeys');
const reverseTableIndexes = require('./reverseTableIndexes');
const defineRequiredFields = require('./defineRequiredFields');
const defineFieldsDescription = require('./defineFieldsDescription');
const doesViewHaveRelatedTables = require('./doesViewHaveRelatedTables');
const changeViewPropertiesToReferences = require('./changeViewPropertiesToReferences');
const defineFieldsKeyConstraints = require('./defineFieldsKeyConstraints');
const defineJSONTypes = require('./defineJSONTypes');
const defineFieldsDefaultConstraintNames = require('./defineFieldsDefaultConstraintNames');
const getKeyConstraintsCompositionStatuses = require('./getKeyConstraintsCompositionStatuses');
const reverseKeyConstraint = require('./reverseKeyConstraint');
const defineFieldsCompositeKeyConstraints = require('./defineFieldsCompositeKeyConstraints');
const reverseTableColumn = require('./reverseTableColumn');
const reorderTableRows = require('./reorderTableRows');
const getUserDefinedTypes = require('./getUserDefinedTypes');
const handleType = require('./handleType');
const containsJson = require('./containsJson');
const reverseTablePartitions = require('./reverseTablePartitions');
const defineMaskedColumns = require('./defineMaskedColumns');

module.exports = {
	transformDatabaseTableInfoToJSON,
	reverseTableForeignKeys,
	reverseTableIndexes,
	defineRequiredFields,
	defineFieldsDescription,
	doesViewHaveRelatedTables,
	changeViewPropertiesToReferences,
	defineFieldsKeyConstraints,
	defineJSONTypes,
	defineFieldsDefaultConstraintNames,
	getKeyConstraintsCompositionStatuses,
	reverseKeyConstraint,
	defineFieldsCompositeKeyConstraints,
	reverseTableColumn,
	reorderTableRows,
	getUserDefinedTypes,
	handleType,
	containsJson,
	reverseTablePartitions,
	defineMaskedColumns,
}
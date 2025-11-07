const _ = require('lodash');
const { commentIfDeactivated } = require('./commentIfDeactivated');
const { trimBraces } = require('./general');
const { checkAllKeysDeactivated, divideIntoActivatedAndDeactivated } = require('../utils/general');
const { assignTemplates } = require('../utils/assignTemplates');
const templates = require('../configs/templates');

const createKeyConstraint =
	({ terminator, isParentActivated }) =>
	keyData => {
		const partition = keyData.partition ? ` ON [${keyData.partition}]` : '';
		const columnMapToString = ({ name }) => `[${name}]`.trim();

		const isAllColumnsDeactivated = checkAllKeysDeactivated(keyData.columns);

		const dividedColumns = divideIntoActivatedAndDeactivated(keyData.columns, columnMapToString);
		const deactivatedColumnsAsString = dividedColumns.deactivatedItems.length
			? commentIfDeactivated(dividedColumns.deactivatedItems.join(', '), { isActivated: false }, true)
			: '';

		const columns =
			!isAllColumnsDeactivated && isParentActivated
				? ' (' + dividedColumns.activatedItems.join(', ') + deactivatedColumnsAsString + ')'
				: ' (' + keyData.columns.map(columnMapToString).join(', ') + ')';

		return {
			statement: assignTemplates(templates.createKeyConstraint, {
				constraintName: keyData.name ? `CONSTRAINT [${keyData.name}] ` : '',
				keyType: keyData.keyType,
				clustered: ' NONCLUSTERED',
				columns,
				options: ' NOT ENFORCED',
				partition,
				terminator,
			}),
			isActivated: !isAllColumnsDeactivated,
		};
	};

const createDefaultConstraint = ({ constraint }) => {
	return assignTemplates(templates.columnDefaultConstraint, {
		constraintName: constraint.name,
		default: trimBraces(constraint.value),
	});
};

const generateConstraintsString = (dividedConstraints, isParentActivated) => {
	const activatedConstraints = dividedConstraints.activatedItems.length
		? ',\n\t' + dividedConstraints.activatedItems.join(',\n\t')
		: '';

	const deactivatedConstraints = dividedConstraints.deactivatedItems.length
		? '\n\t' +
			commentIfDeactivated(
				dividedConstraints.deactivatedItems.join(',\n\t'),
				{ isActivated: !isParentActivated },
				true,
			)
		: '';

	return activatedConstraints + deactivatedConstraints;
};

module.exports = {
	createDefaultConstraint,
	createKeyConstraint,
	generateConstraintsString,
};

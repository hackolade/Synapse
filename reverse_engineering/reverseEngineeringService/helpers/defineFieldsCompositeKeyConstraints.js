const reverseKeyConstraint = require('./reverseKeyConstraint');
const getKeyConstraintsCompositionStatuses = require('./getKeyConstraintsCompositionStatuses');

const UNIQUE = 'UNIQUE';
const PRIMARY_KEY = 'PRIMARY KEY';

const reverseCompositeKeys = keyConstraintsInfo => {
	const keyCompositionStatuses = getKeyConstraintsCompositionStatuses(keyConstraintsInfo);
	return keyConstraintsInfo.reduce((reversedKeys, keyConstraintInfo) => {
		const { columnName, constraintName, constraintType, isDescending } = keyConstraintInfo;
		const compositionStatus = keyCompositionStatuses[constraintName];
		const existingReversedKey = reversedKeys[constraintName];
		const keyType = constraintType === PRIMARY_KEY ? 'compositePrimaryKey' : 'compositeUniqueKey';
		if (!compositionStatus) {
			return reversedKeys;
		}

		if (!existingReversedKey) {
			return {
				...reversedKeys,
				[constraintName]: {
					...reverseKeyConstraint(keyConstraintInfo),
					_type: constraintType,
					[keyType]: [
						{
							name: columnName,
							type: isDescending ? 'descending' : 'ascending',
						},
					],
				},
			};
		}

		const isColumnAlreadyExists = existingReversedKey[keyType].find(column => column.name === columnName);
		if (isColumnAlreadyExists) {
			return reversedKeys;
		}

		return {
			...reversedKeys,
			[constraintName]: {
				...existingReversedKey,
				[keyType]: [
					...existingReversedKey[keyType],
					{
						name: columnName,
						type: isDescending ? 'descending' : 'ascending',
					},
				],
			},
		};
	}, {});
};

const defineFieldsCompositeKeyConstraints = keyConstraintsInfo => {
	const reversedKeyConstraints = reverseCompositeKeys(keyConstraintsInfo);
	return Object.values(reversedKeyConstraints).reduce(
		(keysAcc, keyConstraintInfo) => {
			const { _type, order, ...necessaryInfo } = keyConstraintInfo;

			if (_type === UNIQUE) {
				return {
					...keysAcc,
					uniqueKey: [...keysAcc.uniqueKey, necessaryInfo],
				};
			}

			return {
				...keysAcc,
				primaryKey: [...keysAcc.primaryKey, necessaryInfo],
			};
		},
		{ primaryKey: [], uniqueKey: [] },
	);
};

module.exports = defineFieldsCompositeKeyConstraints;

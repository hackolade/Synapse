const reverseKeyConstraint = require('./reverseKeyConstraint');
const getKeyConstraintsCompositionStatuses = require('./getKeyConstraintsCompositionStatuses');

const UNIQUE = 'UNIQUE';
const PRIMARY_KEY = 'PRIMARY KEY';

const handleKey = (field, keyConstraintInfo) => {
	const { constraintType, constraintName } = keyConstraintInfo;
	switch(constraintType) {
		case UNIQUE: {
			const { uniqueKeyOptions = [] } = field;
			const isAlreadyExists = uniqueKeyOptions.find(currentOptions =>
				currentOptions && currentOptions.constraintName === constraintName);
			if (isAlreadyExists) {
				return {};
			}

			const reversedKeyOptions = reverseKeyConstraint(keyConstraintInfo);
			return {
				unique: true,
				uniqueKeyOptions: uniqueKeyOptions.concat([reversedKeyOptions]),
			};
		};
		case PRIMARY_KEY: {
			return {
				primaryKey: true,
				primaryKeyOptions: reverseKeyConstraint(keyConstraintInfo),
			};
		};
		default:
			return {};
	}
};

const defineFieldsKeyConstraints = keyConstraintsInfo => jsonSchema => {
	const keyCompositionStatuses = getKeyConstraintsCompositionStatuses(keyConstraintsInfo);
	return keyConstraintsInfo.reduce((jsonSchemaAcc, keyConstraintInfo) => {
		const { columnName, constraintName } = keyConstraintInfo;
		const currentField = jsonSchemaAcc.properties[columnName];
		const compositionStatus = keyCompositionStatuses[constraintName];
		if (!currentField || compositionStatus) {
			return jsonSchemaAcc;
		}

		return {
			...jsonSchemaAcc,
			properties: {
				...jsonSchemaAcc.properties,
				[columnName]: {
					...currentField,
					...handleKey(currentField, keyConstraintInfo),
				},
			},
		};
	}, jsonSchema);
};

module.exports = defineFieldsKeyConstraints;

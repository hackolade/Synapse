const handleType = require('./handleType');

const handleDefault = (typeObject, value) => {
	if (!value) {
		return { default: '' };
	}

	const validValue = {
		numeric: Number(value.replace(/(^\(\()|(\)\)$)/g, '')),
		char: value.replace(/(^\(\')|(\'\))$/g, ''),
		xml: value.replace(/(^\(N\')|(\'\))$/g, ''),
	}[typeObject.type] || value;

	return { default: validValue };
};

const handleMaxLengthDataTypes = (maxLength, typeObject) => {
	switch(typeObject.type) {
		case 'binary': {
			if (typeObject.mode === 'varbinary' && maxLength === -1) {
				return { ...typeObject, hasMaxLength: true }
			}

			return typeObject;
		};
		case 'char': {
			if ((typeObject.mode === 'varchar' || typeObject.mode === 'nvarchar') && maxLength === -1) {
				return { ...typeObject, hasMaxLength: true }
			}

			return typeObject;
		};
		default: return typeObject;
	}
}

const handleIdentity = (column, value) => {
	if (value !== 1) {
		return {};
	}

	return {
		identity: {
			identitySeed: column['SEED_VALUE'],
			identityIncrement: column['INCREMENT_VALUE'],
		},
	};
};

const handleColumnProperty = (column, propertyName, value) => {
	switch(propertyName) {
		case 'DATA_TYPE': return handleMaxLengthDataTypes(column['CHARACTER_MAXIMUM_LENGTH'], handleType(value));
		case 'CHARACTER_MAXIMUM_LENGTH': return { length: value };
		case 'COLUMN_DEFAULT': return handleDefault(handleType(column['DATA_TYPE']), value);
		case 'IS_NULLABLE': return { required: value === 'NO' ? true : false };
		case 'DATETIME_PRECISION': return { fractSecPrecision: !isNaN(value) ? value : '' };
		case 'NUMERIC_SCALE': return { scale: !isNaN(value) ? value : '' };
		case 'NUMERIC_PRECISION': return { precision: !isNaN(value) ? value : '' };
		case 'IS_IDENTITY': return handleIdentity(column, value);
		case 'IS_SPARSE': return { sparse: Boolean(value) };
		default: return {};
	}
};

const reverseTableColumn = column =>
	Object.entries(column).reduce((jsonSchema, [propertyName, value]) => ({
		...jsonSchema,
		...handleColumnProperty(column, propertyName, value),
	}), {});

module.exports = reverseTableColumn;

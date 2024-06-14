const handleType = type => {
	switch (type) {
		case 'smalldatetime':
		case 'time':
		case 'timestamp':
		case 'datetimeoffset':
		case 'datetime2':
		case 'datetime':
		case 'date':
			return { type: 'datetime', mode: type };
		case 'image':
		case 'varbinary':
		case 'binary':
			return { type: 'binary', mode: type };
		case 'nchar':
		case 'ntext':
		case 'text':
		case 'char':
		case 'nvarchar':
		case 'varchar':
			return { type: 'char', mode: type };
		case 'decimal':
		case 'float':
		case 'money':
		case 'numeric':
		case 'real':
		case 'smallint':
		case 'smallmoney':
		case 'tinyint':
		case 'int':
		case 'bit':
		case 'bigint':
			return { type: 'numeric', mode: type };
		case 'geography':
		case 'geometry':
		case 'hierarchyid':
		case 'sql_variant':
		case 'uniqueidentifier':
		case 'xml':
		case 'cursor':
		case 'rowversion':
			return { type };
		default:
			return { type };
	}
};

module.exports = handleType;

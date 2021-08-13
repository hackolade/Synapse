const sql = require('mssql');
const { getObjectsFromDatabase, getNewConnectionClientByDb } = require('./helpers');


const QUERY_REQUEST_TIMEOUT = 60000;

const getConnectionClient = async connectionInfo => {
	const hostName = getHostName(connectionInfo.host);
	const userName = isEmail(connectionInfo.userName) && hostName ? `${connectionInfo.userName}@${hostName}` : connectionInfo.userName;

	if (connectionInfo.authMethod === 'Username / Password') {
		return await sql.connect({
			user: userName,
			password: connectionInfo.userPassword,
			server: connectionInfo.host,
			port: connectionInfo.port,
			database: connectionInfo.databaseName,
			options: {
				encrypt: true,
				enableArithAbort: true
			},
			connectTimeout: Number(connectionInfo.queryRequestTimeout) || 60000,
			requestTimeout:  Number(connectionInfo.queryRequestTimeout) || 60000,
		});
	} else if (connectionInfo.authMethod === 'Azure Active Directory (Username / Password)') {
		return await sql.connect({
			user: userName,
			password: connectionInfo.userPassword,
			server: connectionInfo.host,
			port: +connectionInfo.port,
			database: connectionInfo.databaseName,
			options: {
				encrypt: true,
				enableArithAbort: true
			},
			authentication: {
				type: 'azure-active-directory-password',
			},
			connectTimeout: QUERY_REQUEST_TIMEOUT,
			requestTimeout: QUERY_REQUEST_TIMEOUT
		});
	}

	return await sql.connect(connectionInfo.connectionString);
};

const isEmail = name => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name || '');

const getHostName = url => (url || '').split('.')[0];

const getTableInfo = async (connectionClient, dbName, tableName, tableSchema) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${tableSchema}.${tableName}`;
	return await currentDbConnectionClient.query`
		SELECT c.*,
				ic.SEED_VALUE,
				ic.INCREMENT_VALUE,
				sc.is_sparse AS IS_SPARSE,
				sc.is_identity AS IS_IDENTITY,
				o.type AS TABLE_TYPE
		FROM information_schema.columns as c
		LEFT JOIN SYS.IDENTITY_COLUMNS ic ON ic.object_id=object_id(${objectId})
		LEFT JOIN sys.objects o ON o.object_id=object_id(${objectId})
		LEFT JOIN sys.columns as sc ON object_id(${objectId}) = sc.object_id AND c.column_name = sc.name
		WHERE c.table_name = ${tableName}
		AND c.table_schema = ${tableSchema}
	;`
};

const queryDistribution = async (connectionClient, dbName, tableName, tableSchema) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${tableSchema}.${tableName}`;

	try {
		return await currentDbConnectionClient.query`
			SELECT td.distribution_policy as DISTRIBUTION_POLICY,
				vd.distribution_policy as VIEW_DISTRIBUTION_POLICY
			FROM sys.pdw_table_distribution_properties as td
			LEFT JOIN sys.pdw_materialized_view_distribution_properties as vd ON td.object_id = vd.object_id
			WHERE object_id(${objectId}) = td.object_id
		`;
	} catch (e) {
		return [];
	}
};

const getTableRow = async (connectionClient, dbName, tableName, tableSchema, reverseEngineeringOptions, logger) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const percentageWord = reverseEngineeringOptions.isAbsoluteValue ? '' : 'PERCENT';
	try {
		return await currentDbConnectionClient
			.request()
			.input('tableName', sql.VarChar, tableName)
			.input('tableSchema', sql.VarChar, tableSchema)
			.input('amount', sql.Int, reverseEngineeringOptions.value)
			.input('percent', sql.VarChar, percentageWord)
			.query`EXEC('SELECT TOP '+ @Amount +' '+ @Percent +' * FROM [' + @TableSchema + '].[' + @TableName + '];');`;
	} catch (e) {
		logger.log('error', { type: 'Error getting rows for sampling', message: e.message, stack: e.stack }, `${dbName}.${tableName}`);
		return [];
	}
};

const getTableForeignKeys = async (connectionClient, dbName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	return await currentDbConnectionClient.query`
		SELECT obj.name AS FK_NAME,
				sch.name AS [schema_name],
				tab1.name AS [table],
				col1.name AS [column],
				tab2.name AS [referenced_table],
				col2.name AS [referenced_column]
		FROM sys.foreign_key_columns fkc
		INNER JOIN sys.objects obj
			ON obj.object_id = fkc.constraint_object_id
		INNER JOIN sys.tables tab1
			ON tab1.object_id = fkc.parent_object_id
		INNER JOIN sys.schemas sch
			ON tab1.schema_id = sch.schema_id
		INNER JOIN sys.columns col1
			ON col1.column_id = parent_column_id AND col1.object_id = tab1.object_id
		INNER JOIN sys.tables tab2
			ON tab2.object_id = fkc.referenced_object_id
		INNER JOIN sys.columns col2
			ON col2.column_id = referenced_column_id AND col2.object_id = tab2.object_id
		`
};

const getDistributedColumns = async (connectionClient, dbName, tableName, tableSchema) => {
	const objectId = `${tableSchema}.${tableName}`;
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

	return await currentDbConnectionClient.query`SELECT
		COL_NAME(object_id(${objectId}), column_id) as columnName
	FROM sys.pdw_column_distribution_properties
	WHERE
		object_id = object_id(${objectId}) AND
		distribution_ordinal <> 0
	`;
};

const getViewDistributedColumns = async (connectionClient, dbName, tableName, tableSchema) => {
	const objectId = `${tableSchema}.${tableName}`;
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

	return await currentDbConnectionClient.query`SELECT
		COL_NAME(object_id(${objectId}), column_id) as columnName
	FROM sys.pdw_materialized_view_column_distribution_properties
	WHERE
		object_id = object_id(${objectId}) AND
		distribution_ordinal <> 0
	`;
};

const getDatabaseIndexes = async (connectionClient, dbName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	return await currentDbConnectionClient.query`
		SELECT
			TableName = t.name,
			IndexName = ind.name,
			ic.is_descending_key,
			ic.is_included_column,
			ic.column_store_order_ordinal,
			COL_NAME(t.object_id, ic.column_id) as columnName,
			S.name as schemaName,
			p.data_compression_desc as dataCompression,
			ind.*
		FROM sys.indexes ind
		LEFT JOIN sys.tables t
			ON ind.object_id = t.object_id
		INNER JOIN sys.index_columns ic
			ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
		INNER JOIN sys.partitions p
			ON p.object_id = t.object_id AND ind.index_id = p.index_id
		INNER JOIN sys.objects O ON O.object_id = t.object_id
		INNER JOIN sys.schemas S ON S.schema_id = O.schema_id
		WHERE
			ind.is_primary_key = 0
			AND ind.is_unique_constraint = 0
			AND t.is_ms_shipped = 0
		`;
};

const getViewsIndexes = async (connectionClient, dbName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	return await currentDbConnectionClient.query`
		SELECT
			TableName = t.name,
			IndexName = ind.name,
			ic.is_descending_key,
			ic.is_included_column,
			COL_NAME(t.object_id, ic.column_id) as columnName,
			OBJECT_SCHEMA_NAME(t.object_id) as schemaName,
			p.data_compression_desc as dataCompression,
			ind.*
		FROM sys.indexes ind
		LEFT JOIN sys.views t
			ON ind.object_id = t.object_id
		INNER JOIN sys.index_columns ic
			ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
		INNER JOIN sys.partitions p
			ON p.object_id = t.object_id AND ind.index_id = p.index_id
		WHERE
			ind.is_primary_key = 0
			AND ind.is_unique_constraint = 0
			AND t.is_ms_shipped = 0
		`;
};

const getTableColumnsDescription = async (connectionClient, dbName, tableName, schemaName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	return currentDbConnectionClient.query`
		select
			st.name [Table],
			sc.name [Column],
			sep.value [Description]
		from sys.tables st
		inner join sys.columns sc on st.object_id = sc.object_id
		left join sys.extended_properties sep on st.object_id = sep.major_id
														and sc.column_id = sep.minor_id
														and sep.name = 'MS_Description'
		where st.name = ${tableName}
		and st.schema_id=schema_id(${schemaName})
	`;
};

const getDatabaseMemoryOptimizedTables = async (connectionClient, dbName) => {
	try {
		const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

		return currentDbConnectionClient.query`
			SELECT
				T.name,
				T.durability,
				T.durability_desc,
				OBJECT_NAME(T.history_table_id) AS history_table,
				SCHEMA_NAME(O.schema_id) AS history_schema,
				T.temporal_type_desc
			FROM sys.tables T LEFT JOIN sys.objects O ON T.history_table_id = O.object_id
			WHERE T.is_memory_optimized=1
		`;
	} catch (error) {
		logger.log('error', { message: error.message, stack: error.stack, error }, 'Retrieve memory optimzed tables');

		return [];
	}
};

const getViewColumns = async (connectionClient, dbName, viewName, schemaName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${viewName}`;

	return currentDbConnectionClient.query`
		select c.name as name,
			v.name as viewName,
			m.name as type,
			m.is_user_defined 
		from sys.columns c
		join sys.views v on v.object_id = c.object_id
		join sys.types as m on
			m.system_type_id = c.system_type_id and
			m.user_type_id = c.user_type_id
		where c.object_id=object_id(${objectId})
	`;
};

const getViewTableInfo = async (connectionClient, dbName, viewName, schemaName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${viewName}`;

	return currentDbConnectionClient.query`
		select
			schema_name(v.schema_id) as schema_name,
			v.name as ViewName,
			schema_name(o.schema_id) as ReferencedSchemaName,
			o.name as ReferencedTableName
		from sys.views v
			join sys.sql_expression_dependencies d
				on d.referencing_id = v.object_id
				and d.referenced_id is not null
			join sys.objects o
				on o.object_id = d.referenced_id
		WHERE v.object_id=object_id(${objectId})
	`;
};

const getViewColumnRelations = async (connectionClient, dbName, viewName, schemaName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	return currentDbConnectionClient
		.request()
		.input('tableName', sql.VarChar, viewName)
		.input('tableSchema', sql.VarChar, schemaName)
		.query`
			SELECT name, source_database, source_schema,
				source_table, source_column
			FROM sys.dm_exec_describe_first_result_set(N'SELECT TOP 1 * FROM [' + @TableSchema + '].[' + @TableName + ']', null, 1)
			WHERE is_hidden=0
	`;
};

const getViewStatement = async (connectionClient, dbName, viewName, schemaName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${viewName}`;
	return currentDbConnectionClient
		.query`SELECT M.*, V.with_check_option
			FROM sys.sql_modules M INNER JOIN sys.views V ON M.object_id=V.object_id
			WHERE M.object_id=object_id(${objectId})
		`;
};

const getTableKeyConstraints = async (connectionClient, dbName, tableName, schemaName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${tableName}`;
	return currentDbConnectionClient.query`
		SELECT
			'${tableName}' as tableName,
			ind.name as constraintName,
			sc.name as columnName,
			constraintType = CASE
				WHEN ind.is_unique_constraint=1 THEN 'UNIQUE'   
				WHEN ind.is_primary_key=1 THEN 'PRIMARY KEY'
				ELSE 'FOREIGN KEY'
			END,
			ind.type_desc as typeDesc,
			p.data_compression_desc as dataCompression,
			ds.name as dataSpaceName,
			st.no_recompute as statisticNoRecompute,
			st.is_incremental as statisticsIncremental,
			ic.is_descending_key as isDescending,
			ind.*
		FROM sys.indexes ind
			INNER JOIN sys.stats st ON st.name = ind.name AND st.object_id = object_id(${objectId})
			INNER JOIN sys.data_spaces ds ON ds.data_space_id = ind.data_space_id
			INNER JOIN sys.index_columns ic ON ind.index_id=ic.index_id AND ic.object_id = object_id(${objectId})
			INNER JOIN sys.columns sc ON sc.column_id = ic.column_id AND sc.object_id = object_id(${objectId})
			INNER JOIN sys.partitions p ON p.index_id = ind.index_id AND p.object_id = object_id(${objectId})
		WHERE ind.object_id=object_id(${objectId}) AND (ind.is_unique_constraint=1 OR ind.is_primary_key=1)
		ORDER BY ind.name
	`;
};

const getTableDefaultConstraintNames = async (connectionClient, dbName, tableName, schemaName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	return currentDbConnectionClient.query`
	SELECT
		ac.name as columnName,
		dc.name
	FROM 
		sys.all_columns as ac
			INNER JOIN
		sys.tables
			ON ac.object_id = tables.object_id
			INNER JOIN 
		sys.schemas
			ON tables.schema_id = schemas.schema_id
			INNER JOIN
		sys.default_constraints as dc
			ON ac.default_object_id = dc.object_id
	WHERE 
			schemas.name = ${schemaName}
		AND tables.name = ${tableName}
	`
};

const getDatabaseUserDefinedTypes = async (connectionClient, dbName) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	return currentDbConnectionClient.query`
		select * from sys.types
		where is_user_defined = 1
	`;
}

module.exports = {
	getConnectionClient,
	getObjectsFromDatabase,
	getTableInfo,
	getTableRow,
	getTableForeignKeys,
	getDatabaseIndexes,
	getTableColumnsDescription,
	getDatabaseMemoryOptimizedTables,
	getViewTableInfo,
	getTableKeyConstraints,
	getViewColumnRelations,
	getTableDefaultConstraintNames,
	getDatabaseUserDefinedTypes,
	getViewStatement,
	getViewsIndexes,
	getViewColumns,
	getDistributedColumns,
	getViewDistributedColumns,
	queryDistribution,
}

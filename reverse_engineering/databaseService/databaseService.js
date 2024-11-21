const axios = require('axios');
const sql = require('mssql');
const https = require('https');
const { getObjectsFromDatabase, getNewConnectionClientByDb } = require('./helpers');
const getSampleDocSize = require('../helpers/getSampleDocSize');
const { logAuthTokenInfo } = require('../helpers/logInfo');
const { getConnection } = require('./helpers/connection');
const {
	queryForRetrievingTheTablesSelectedByTheUser,
} = require('../queries/queryForRetrievingTheTablesSelectedByTheUser');
const { progress } = require('../helpers/logInfo');

const QUERY_REQUEST_TIMEOUT = 60000;

const getConnectionClient = async (connectionInfo, logger) => {
	const hostName = getHostName(connectionInfo.host);
	const userName =
		isEmail(connectionInfo.userName) && hostName
			? `${connectionInfo.userName}@${hostName}`
			: connectionInfo.userName;
	const tenantId = connectionInfo.connectionTenantId || connectionInfo.tenantId || 'common';
	const queryRequestTimeout = Number(connectionInfo.queryRequestTimeout) || QUERY_REQUEST_TIMEOUT;

	const commonConfig = {
		server: connectionInfo.host,
		port: Number(connectionInfo.port),
		database: connectionInfo.databaseName,
		connectTimeout: queryRequestTimeout,
		requestTimeout: queryRequestTimeout,
	};
	const credentialsConfig = {
		user: userName,
		password: connectionInfo.userPassword,
	};

	const clientId = '0dc36597-bc44-49f8-a4a7-ae5401959b85';
	const redirectUri = 'http://localhost:8080';

	const connection = getConnection({
		authMethod: connectionInfo.authMethod,
		connectionInfo,
		commonConfig,
		credentialsConfig,
		tenantId,
		clientId,
		redirectUri,
		logger,
	});

	return connection.connect();
};

const isEmail = name => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name || '');

const getHostName = url => (url || '').split('.')[0];

const getTableInfo = async ({ connectionClient, dbName, tableName, tableSchema, logger }) => {
	progress(logger, 'Fetching table information', dbName, tableName);
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${tableSchema}.${tableName}`;

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
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
		;`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ type: 'Error getting table info', message: error.message, stack: error.stack, error },
			`Get '${tableName}' table info.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer '${tableName}' table info.`,
			containerName: tableSchema,
			entityName: tableName,
		});

		return;
	}
};

const queryDistribution = async ({ connectionClient, dbName, tableName, tableSchema, logger }) => {
	const objectId = `${tableSchema}.${tableName}`;
	logger.log('info', { message: `Get '${objectId}' query distribution.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

	try {
		return await currentDbConnectionClient.query`
			SELECT td.distribution_policy as DISTRIBUTION_POLICY,
				vd.distribution_policy as VIEW_DISTRIBUTION_POLICY
			FROM sys.pdw_table_distribution_properties as td
			LEFT JOIN sys.pdw_materialized_view_distribution_properties as vd ON td.object_id = vd.object_id
			WHERE object_id(${objectId}) = td.object_id
		`;
	} catch (error) {
		logger.log(
			'error',
			{ type: 'Error getting query distribution', message: error.message, stack: error.stack, error },
			`Get '${objectId}' query distribution.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer '${objectId}' query distribution.`,
			containerName: tableSchema,
			entityName: tableName,
		});

		return [];
	}
};

const getTableRow = async ({ connectionClient, dbName, tableName, tableSchema, recordSamplingSettings, logger }) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	try {
		let amount;

		if (recordSamplingSettings.active === 'absolute') {
			amount = Number(recordSamplingSettings.absolute.value);
			if (!amount) {
				return [];
			}
			logger.log(
				'info',
				{ message: `Get ${amount} rows from '${tableName}' table for sampling JSON data.` },
				'Reverse Engineering',
			);
		} else {
			if (!recordSamplingSettings.relative.value) {
				return [];
			}
			const rowCount = await getTableRowCount(tableSchema, tableName, currentDbConnectionClient);
			amount = getSampleDocSize(rowCount, recordSamplingSettings);
			logger.log(
				'info',
				{
					message: `Get ${amount} rows of total ${rowCount} from '${tableName}' table for sampling JSON data.`,
				},
				'Reverse Engineering',
			);
		}

		return mapResponse(
			await currentDbConnectionClient
				.request()
				.input('tableName', sql.VarChar, tableName)
				.input('tableSchema', sql.VarChar, tableSchema)
				.input('amount', sql.Int, amount)
				.query`EXEC('SELECT TOP '+ @Amount +' * FROM [' + @TableSchema + '].[' + @TableName + '];');`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ type: 'Error getting rows for sampling', message: error.message, stack: error.stack },
			`Get '${tableSchema}${tableName}' table rows.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${dbName}.${tableName} rows for sampling.`,
			containerName: tableSchema,
			entityName: tableName,
		});

		return [];
	}
};

const getTableForeignKeys = async ({ connectionClient, dbName, logger }) => {
	progress(logger, 'Fetching tables relationships', dbName);
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	try {
		return mapResponse(
			await currentDbConnectionClient.query`
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
			`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ type: 'Error getting foreign keys', message: error.message, stack: error.stack },
			`Get '${dbName}' database foreign keys.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${dbName} foreign keys.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getDistributedColumns = async ({ connectionClient, dbName, tableName, tableSchema, logger }) => {
	const objectId = `${tableSchema}.${tableName}`;
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	progress(logger, 'Fetching columns distribution info', dbName, tableName);

	try {
		return mapResponse(
			await currentDbConnectionClient.query`SELECT
			COL_NAME(object_id(${objectId}), column_id) as columnName
		FROM sys.pdw_column_distribution_properties
		WHERE
			object_id = object_id(${objectId}) AND
			distribution_ordinal <> 0
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ type: 'Error getting distributed columns', message: error.message, stack: error.stack },
			`Get '${tableSchema}.${tableName}' table distributed columns.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${objectId} distributed columns.`,
			containerName: tableSchema,
			entityName: tableName,
		});

		return [];
	}
};

const getViewDistributedColumns = async ({ connectionClient, dbName, viewName, tableSchema, logger }) => {
	const objectId = `${tableSchema}.${viewName}`;
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	progress(logger, 'Fetching columns distribution info', dbName, viewName);

	try {
		return mapResponse(
			await currentDbConnectionClient.query`SELECT
			COL_NAME(object_id(${objectId}), column_id) as columnName
		FROM sys.pdw_materialized_view_column_distribution_properties
		WHERE
			object_id = object_id(${objectId}) AND
			distribution_ordinal <> 0
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ type: 'Error getting views distributed columns', message: error.message, stack: error.stack },
			`Get '${tableSchema}.${viewName}' view distributed columns.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${objectId} views distributed columns.`,
			containerName: tableSchema,
			entityName: viewName,
		});

		return [];
	}
};

const getDatabaseIndexes = async ({ connectionClient, dbName, logger }) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

	logger.log('info', { message: `Get '${dbName}' database indexes.` }, 'Reverse Engineering');

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
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
			`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ type: 'Error getting indexes', message: error.message, stack: error.stack },
			`Get '${dbName}' database indexes.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${dbName} indexes.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getPartitions = async ({ connectionClient, tablesInfo, dbName, logger }) => {
	logger.log('info', { message: `Get '${dbName}' database partitions.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const tablesSelectedByTheUser = queryForRetrievingTheTablesSelectedByTheUser({ schemaToTablesMap: tablesInfo });

	try {
		const queryForRetrievingThePartitions = `
		WITH user_selected_tables AS (${tablesSelectedByTheUser.sql()})
		SELECT 
				tbl.${tablesSelectedByTheUser.projection.schemaName} AS schemaName,
				tbl.${tablesSelectedByTheUser.projection.tableName} AS tableName,
				prt.partition_number,
				pf.boundary_value_on_right AS range,
				c.name AS name,
				rng.value AS value
			FROM user_selected_tables tbl
			INNER JOIN sys.partitions prt ON prt.object_id = tbl.${tablesSelectedByTheUser.projection.tableId}
			INNER JOIN sys.indexes idx ON prt.object_id = idx.object_id AND prt.index_id = idx.index_id
			INNER JOIN sys.data_spaces ds ON idx.data_space_id = ds.[data_space_id]
			INNER JOIN sys.partition_schemes ps ON ds.data_space_id = ps.data_space_id
			INNER JOIN sys.partition_functions pf ON ps.function_id = pf.function_id
			INNER JOIN sys.index_columns ic ON ic.object_id = idx.object_id AND ic.index_id = idx.index_id AND ic.partition_ordinal >= 1
			INNER JOIN sys.columns c ON tbl.${tablesSelectedByTheUser.projection.tableId} = c.object_id AND ic.column_id = c.column_id
			LEFT JOIN sys.partition_range_values rng ON pf.function_id = rng.function_id AND rng.boundary_id = prt.partition_number 
		`;

		return mapResponse(await currentDbConnectionClient.query(queryForRetrievingThePartitions));
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${dbName}' database tables partitions.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer partitions.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getTableColumnsDescription = async ({ connectionClient, dbName, tableName, schemaName, logger }) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

	logger.log('info', { message: `Get '${tableName}' table columns description.` }, 'Reverse Engineering');

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
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
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${schemaName}.${tableName}' table columns description.`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer table columns description.`,
			containerName: schemaName,
			entityName: tableName,
		});

		return [];
	}
};

const getViewColumns = async ({ connectionClient, dbName, viewName, schemaName, logger }) => {
	logger.log('info', { message: `Get '${viewName}' view columns.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${viewName}`;

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
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
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${schemaName}${viewName}' view columns`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${viewName} view columns.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getViewTableInfo = async ({ connectionClient, dbName, viewName, schemaName, logger }) => {
	logger.log('info', { message: `Get '${viewName}' view table info.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${viewName}`;

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
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
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${schemaName}.${viewName}' view table info`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${viewName} view table info.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getViewStatement = async ({ connectionClient, dbName, viewName, schemaName, logger }) => {
	logger.log('info', { message: `Get '${viewName}' view statement.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${viewName}`;

	try {
		return mapResponse(
			await currentDbConnectionClient.query`SELECT M.*, V.with_check_option
			FROM sys.sql_modules M INNER JOIN sys.views V ON M.object_id=V.object_id
			WHERE M.object_id=object_id(${objectId})
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${schemaName}${viewName}' view statement`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${viewName} view statement.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getTableKeyConstraints = async ({ connectionClient, dbName, tableName, schemaName, logger }) => {
	logger.log('info', { message: `Get '${tableName}' table key constraints.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${tableName}`;

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
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
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${schemaName}.${tableName}' table key constraints`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${tableName} table key constraints.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getTableMaskedColumns = async ({ connectionClient, dbName, tableName, schemaName, logger }) => {
	logger.log('info', { message: `Get '${tableName}' table masked columns.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);
	const objectId = `${schemaName}.${tableName}`;

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
			SELECT name, masking_function FROM sys.masked_columns
			WHERE object_id=OBJECT_ID(${objectId})
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${schemaName}.${tableName}' table masked columns`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${tableName} table masked columns.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const getTableDefaultConstraintNames = async ({ connectionClient, dbName, tableName, schemaName, logger }) => {
	logger.log('info', { message: `Get '${tableName}' table default constraint names.` }, 'Reverse Engineering');
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
			SELECT
				ac.name as columnName,
				dc.name
			FROM 
				sys.columns as ac
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
			`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Get '${schemaName}.${tableName}' table default constraint names`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${tableName} table default constraint names.`,
			containerName: '',
			entityName: tableName,
		});

		return [];
	}
};

const getDatabaseUserDefinedTypes = async ({ connectionClient, dbName, logger }) => {
	const currentDbConnectionClient = await getNewConnectionClientByDb(connectionClient, dbName);

	logger.log('info', { message: `Get '${dbName}' database UDTs.` }, 'Reverse Engineering');

	try {
		return mapResponse(
			await currentDbConnectionClient.query`
			select * from sys.types
			where is_user_defined = 1
		`,
		);
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Retrieve '${dbName}' database UDTs`,
		);
		logger.progress({
			message: `Warning: failed to reverse-engineer ${dbName} database UDTs.`,
			containerName: '',
			entityName: '',
		});

		return [];
	}
};

const mapResponse = async (response = {}) => {
	return (await response)?.recordset;
};

async function getTableRowCount(tableSchema, tableName, currentDbConnectionClient) {
	const rowCountQuery = `SELECT COUNT(*) as rowsCount FROM [${tableSchema}].[${tableName}]`;
	const rowCountResponse = await currentDbConnectionClient.query(rowCountQuery);
	const rowCount = rowCountResponse?.recordset[0]?.rowsCount;

	return rowCount;
}

module.exports = {
	getConnectionClient,
	getObjectsFromDatabase,
	getTableInfo,
	getTableRow,
	getTableForeignKeys,
	getDatabaseIndexes,
	getTableColumnsDescription,
	getViewTableInfo,
	getTableKeyConstraints,
	getTableMaskedColumns,
	getTableDefaultConstraintNames,
	getDatabaseUserDefinedTypes,
	getViewStatement,
	getViewColumns,
	getDistributedColumns,
	getViewDistributedColumns,
	queryDistribution,
	getPartitions,
};

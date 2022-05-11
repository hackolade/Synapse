module.exports = {
	createDatabase: 'CREATE DATABASE [${name}]${terminator}\nUSE [${name}]${terminator}',

	createSchema: 'CREATE SCHEMA [${name}]${terminator}',

	createTable:
		'CREATE${external} TABLE ${name} (\n' +
		'\t${column_definitions}${temporalTableTime}${keyConstraints}${checkConstraints}${foreignKeyConstraints}${memoryOptimizedIndexes}\n' +
		')${options}${terminator}\n',

	columnDefinition:
		'[${name}] ${type}${primary_key}${temporalTableTime}${sparse}${maskedWithFunction}${identity}${default}${collation}${not_null}${encryptedWith}',

	partition: 'PARTITION ([${name}] RANGE ${range} FOR VALUES (${values}))',

	index:
		'CREATE${unique}${clustered}${columnstore} INDEX ${name}\n' +
		'\tON ${table} ( ${keys} )${include}${expression}${relational_index_option}${terminator}\n',

	fullTextIndex:
		'CREATE FULLTEXT INDEX ON ${table} (\n\t${keys}\n)\nKEY INDEX ${indexName}\n${catalog}${options}${terminator}\n',

	spatialIndex: 'CREATE SPATIAL INDEX ${name} ON ${table} (${column})${using}\n${options}${terminator}\n',

	checkConstraint: 'CONSTRAINT [${name}] CHECK${notForReplication} (${expression})',

	createForeignKeyConstraint:
		'CONSTRAINT [${name}] FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable}(${primaryKey})',

	createView:
		'CREATE${materialized} VIEW ${name}\n${view_attribute}AS ${select_statement}${check_option}${options}${terminator}\n',

	viewSelectStatement: 'SELECT ${keys}\n\tFROM ${tableName}\n',

	createUdtFromBaseType: 'CREATE TYPE ${name} FROM ${base_type}${not_null}${terminator}\n',

	createKeyConstraint: '${constraintName}${keyType}${clustered}${columns}${options}${partition}',

	createDefaultConstraint:
		'ALTER TABLE ${tableName} ADD CONSTRAINT [${constraintName}] DEFAULT (${default}) FOR [${columnName}]${terminator}\n',

	ifNotExistSchema:
		"IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'[${schemaName}]')\nbegin\n\tEXEC('${statement}')\nend${terminator}",

	ifNotExistDatabase:
		"IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'[${databaseName}]')\nbegin\n${statement}\nend${terminator}",

	ifNotExistTable:
		"IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'${tableName}') AND type in (N'U'))\nbegin\n${statement}\nend${terminator}",

	ifNotExistView:
		"IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'${viewName}') AND type in (N'V'))\nbegin\n${statement}\nend${terminator}",

	dropSchema: 'DROP SCHEMA IF EXISTS [${name}]${terminator}',

	dropTable: 'DROP TABLE IF EXISTS ${name}${terminator}',

	dropIndex: 'DROP INDEX IF EXISTS [${name}] ON ${object}${terminator}',

	alterTableOptions: 'ALTER TABLE ${tableName} ${options}${terminator}',

	alterTableAddConstraint: 'ALTER TABLE ${tableName} ADD ${constraint}${terminator}',

	alterTable: 'ALTER TABLE ${tableName} ${command}${terminator}',

	dropColumn: 'DROP COLUMN [${name}]',

	addColumn: 'ADD COLUMN ${script}',

	alterColumn: 'ALTER COLUMN [${name}] ${type}${collation}${not_null}',

	renameColumn: "EXEC sp_rename '${fullTableName}.${oldColumnName}', '${newColumnName}', 'COLUMN';${terminator}",

	dropView: 'DROP VIEW IF EXISTS ${name}${terminator}',

	alterView: 'ALTER VIEW ${name}\nAS ${select_statement}${terminator}',

};
